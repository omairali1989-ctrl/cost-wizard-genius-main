/**
 * Seeds the Scope Blueprint catalogue into Supabase.
 *
 *   bun run scripts/seed-blueprints.ts               # shared master templates
 *   bun run scripts/seed-blueprints.ts --per-company # bootstrap into each workspace
 *
 * Master seeding needs migration 20260913120000, which makes project_presets.company_id
 * nullable. Until that migration is applied, --per-company writes a copy into every
 * existing workspace instead — that is data-only, so it works against today's schema.
 *
 * Note the trade-off: a per-company row is that workspace's OWN copy, so the manager
 * labels it "Edited here" and offers "Reset to standard", which would delete it. Prefer
 * master seeding once the migration has run.
 */
import { readFileSync } from "node:fs";
import { BLUEPRINT_CATALOGUE, validateCatalogue } from "./blueprint-catalogue";

const strip = (v: string) => v.trim().replace(/^["']|["']$/g, "");

function loadEnv(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(".env", "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), strip(l.slice(i + 1))];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...loadEnv(), ...process.env } as Record<string, string>;
const url = strip(env["SUPABASE_URL"] ?? env["VITE_SUPABASE_URL"] ?? "");
const key = strip(env["SUPABASE_SECRET_KEY"] ?? "");
const perCompany = process.argv.includes("--per-company");

if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set (.env or environment).");
  process.exit(1);
}

const problems = validateCatalogue(BLUEPRINT_CATALOGUE);
if (problems.length) {
  console.error("Catalogue is invalid:\n" + problems.join("\n"));
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

const configFor = (bp: (typeof BLUEPRINT_CATALOGUE)[number]) => ({
  id: bp.id,
  category: bp.category,
  badge: bp.badge,
  title: bp.title,
  description: bp.description,
  defaultDurationValue: bp.defaultDurationValue,
  defaultDurationUnit: bp.defaultDurationUnit,
  suggestedRoles: bp.suggestedRoles,
  techStack: bp.techStack,
});

async function upsert(rows: Record<string, unknown>[], conflict: string) {
  const res = await fetch(`${url}/rest/v1/project_presets?on_conflict=${conflict}`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

async function main() {
  console.log(`Catalogue: ${BLUEPRINT_CATALOGUE.length} blueprints`);

  if (!perCompany) {
    const rows = BLUEPRINT_CATALOGUE.map((bp) => ({
      company_id: null,
      id: bp.id,
      config: configFor(bp),
    }));
    try {
      await upsert(rows, "id");
      console.log(`Seeded ${rows.length} shared master templates.`);
      return;
    } catch (error) {
      console.error("Master seeding failed:", (error as Error).message);
      console.error(
        "\nThis usually means migration 20260913120000 has not been applied yet, so\n" +
          "project_presets.company_id is still NOT NULL. Either apply the migration, or\n" +
          "re-run with --per-company to bootstrap each workspace against today's schema.",
      );
      process.exit(1);
    }
  }

  const res = await fetch(`${url}/rest/v1/companies?select=id,name`, { headers });
  if (!res.ok) {
    console.error(`Could not list companies: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const companies = (await res.json()) as { id: string; name: string }[];
  if (!companies.length) {
    console.log("No companies found — nothing to seed.");
    return;
  }

  for (const company of companies) {
    const rows = BLUEPRINT_CATALOGUE.map((bp) => ({
      company_id: company.id,
      id: bp.id,
      config: configFor(bp),
    }));
    await upsert(rows, "company_id,id");
    console.log(`  ${company.name}: ${rows.length} blueprints`);
  }
  console.log(`Seeded ${companies.length} workspace(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
