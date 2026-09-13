/**
 * Resolves a blueprint's suggested role to a real person in the current workspace.
 *
 * Blueprints used to name individuals, which meant a template authored in one
 * workspace matched nobody in any other. They now carry a role term — "backend",
 * "project manager", "qa" — and this resolves it against what a workspace actually
 * knows about its people: their title, their skills, their department, and only
 * then their name (so any legacy template naming a person still works).
 */

export interface MatchableEmployee {
  id: string;
  name: string;
  job_title?: string | null;
  department?: string | null;
  skills?: string[] | null;
  active?: boolean;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** "full stack" should also hit "fullstack" and "full-stack". */
const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const SYNONYMS: Record<string, string[]> = {
  "tech lead": ["tech lead", "technical lead", "team lead", "lead engineer", "architect", "cto"],
  "full stack": ["full stack", "fullstack", "generalist"],
  backend: ["backend", "back end", "server", "api", "node", "laravel", "php", "python", "java"],
  frontend: ["frontend", "front end", "web", "react", "vue", "angular", "ui engineer"],
  mobile: ["mobile", "ios", "android", "flutter", "react native"],
  designer: ["designer", "design", "ui ux", "ux", "ui", "creative", "graphic"],
  "project manager": ["project manager", "delivery manager", "scrum master", "producer", "pm"],
  qa: ["qa", "quality", "test", "tester", "sdet"],
  devops: ["devops", "sre", "infrastructure", "platform", "cloud"],
  "business analyst": ["business analyst", "analyst", "product owner", "product manager", "ba"],
};

const termsFor = (role: string): string[] => {
  const key = normalize(role);
  return SYNONYMS[key] ?? [key];
};

/** Everything the workspace knows about a person, as one searchable haystack per field. */
const haystacks = (employee: MatchableEmployee) => ({
  title: normalize(employee.job_title ?? ""),
  skills: normalize((employee.skills ?? []).join(" ")),
  department: normalize(employee.department ?? ""),
  name: normalize(employee.name ?? ""),
});

const hits = (haystack: string, terms: string[]) =>
  terms.some((term) => haystack.includes(term) || compact(haystack).includes(compact(term)));

export interface MatchOptions {
  /** Ids already taken by another role, so one person is not assigned twice over. */
  exclude?: Set<string>;
  /** Match inactive people too. Off by default — you cannot staff a project with leavers. */
  includeInactive?: boolean;
}

/**
 * Title beats skills beats department beats name, so "backend" prefers someone whose
 * job actually is backend over someone who merely lists it as a skill.
 */
export function matchEmployeeForRole<T extends MatchableEmployee>(
  role: string,
  employees: T[],
  options: MatchOptions = {},
): T | undefined {
  const terms = termsFor(role);
  if (!terms.length) return undefined;

  const pool = employees.filter(
    (e) => (options.includeInactive || e.active !== false) && !options.exclude?.has(e.id),
  );
  if (!pool.length) return undefined;

  for (const field of ["title", "skills", "department", "name"] as const) {
    const found = pool.find((e) => hits(haystacks(e)[field], terms));
    if (found) return found;
  }
  return undefined;
}

/**
 * Resolves a whole blueprint's roles at once, giving each role a different person
 * where the workspace has enough people, and reporting the roles it could not fill
 * so the UI can say so rather than silently dropping their hours.
 */
export function matchRoles<T extends MatchableEmployee>(
  roles: { nameSubstr: string; label: string; allocationPct: number }[],
  employees: T[],
): {
  matched: { role: (typeof roles)[number]; employee: T }[];
  unmatched: (typeof roles)[number][];
} {
  const taken = new Set<string>();
  const matched: { role: (typeof roles)[number]; employee: T }[] = [];
  const unmatched: (typeof roles)[number][] = [];

  for (const role of roles) {
    // Prefer someone not yet used; fall back to reusing a person on a small team.
    const employee =
      matchEmployeeForRole(role.nameSubstr, employees, { exclude: taken }) ??
      matchEmployeeForRole(role.nameSubstr, employees);
    if (employee) {
      taken.add(employee.id);
      matched.push({ role, employee });
    } else {
      unmatched.push(role);
    }
  }
  return { matched, unmatched };
}
