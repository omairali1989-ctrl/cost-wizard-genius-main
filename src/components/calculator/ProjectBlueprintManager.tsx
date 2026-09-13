import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArchiveRestore,
  Archive,
  Copy,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sliders,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/workspace";
import { PRESET_CATEGORIES, type PresetCategory, type PresetConfig } from "./qce/types";
import {
  PRESET_CSV_COLUMNS,
  parsePresetJson,
  presetsFromCsvRows,
  presetsToCsvRows,
  serializePreset,
  usePresetLibrary,
} from "./qce/presetLibrary";
import { downloadCsv, downloadJson, fromCsv } from "@/lib/csv";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = PRESET_CATEGORIES.filter((category) => category !== "All");
const TIME_UNITS = ["hours", "days", "weeks", "months"] as const;
type TimeUnit = (typeof TIME_UNITS)[number];

const createForm = () => ({
  id: "",
  title: "",
  category: "Startups & Custom" as PresetCategory,
  badge: "Custom Blueprint",
  description: "",
  durationValue: 1,
  durationUnit: "months" as TimeUnit,
  suggestedRoles: "",
});

type BlueprintForm = ReturnType<typeof createForm>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function roleText(preset: PresetConfig) {
  return preset.suggestedRoles
    .map((role) => `${role.nameSubstr} | ${role.label} | ${role.allocationPct}`)
    .join("\n");
}

function parseRoles(value: string) {
  const roles = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [nameSubstr, label, allocation] = line.split("|").map((part) => part.trim());
      if (!nameSubstr || !label || !allocation) {
        throw new Error(
          `Suggested role line ${index + 1} must use: employee | role | allocation %`,
        );
      }
      const allocationPct = Number(allocation);
      if (!Number.isFinite(allocationPct) || allocationPct < 0 || allocationPct > 100) {
        throw new Error(`Suggested role line ${index + 1} needs an allocation between 0 and 100.`);
      }
      return { nameSubstr, label, allocationPct };
    });

  // Allocation is a share of the whole timeline, so one person cannot exceed 100%
  // across their lines without booking more time than the project has.
  const perPerson = new Map<string, number>();
  for (const role of roles) {
    perPerson.set(role.nameSubstr, (perPerson.get(role.nameSubstr) ?? 0) + role.allocationPct);
  }
  const over = [...perPerson.entries()].filter(([, total]) => total > 100);
  if (over.length) {
    throw new Error(
      `${over.map(([name, total]) => `${name} is booked at ${total}%`).join("; ")} — each person must total 100% or less.`,
    );
  }
  return roles;
}

interface ProjectBlueprintManagerProps {
  companyId: string;
  canManage: boolean;
}

export function ProjectBlueprintManager({ companyId, canManage }: ProjectBlueprintManagerProps) {
  const {
    presets,
    loading,
    archivedPresets,
    customPresetIds,
    savePreset,
    importPresets,
    archivePreset,
    restorePreset,
    deletePreset,
  } = usePresetLibrary(companyId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory | "All">("All");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetConfig | null>(null);
  const [form, setForm] = useState<BlueprintForm>(createForm());
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredPresets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return presets.filter((preset) => {
      const categoryMatches = selectedCategory === "All" || preset.category === selectedCategory;
      const searchMatches =
        !query ||
        preset.title.toLowerCase().includes(query) ||
        preset.description.toLowerCase().includes(query) ||
        preset.badge.toLowerCase().includes(query);
      return categoryMatches && searchMatches;
    });
  }, [presets, searchQuery, selectedCategory]);

  const openAddForm = () => {
    setEditingPreset(null);
    setForm(createForm());
    setFormOpen(true);
  };

  const fillForm = (preset: PresetConfig, overrides: Partial<BlueprintForm> = {}) => ({
    id: preset.id,
    title: preset.title,
    category: preset.category,
    badge: preset.badge,
    description: preset.description,
    durationValue: preset.defaultDurationValue,
    durationUnit: preset.defaultDurationUnit,
    suggestedRoles: roleText(preset),
    ...overrides,
  });

  const openEditForm = (preset: PresetConfig) => {
    setEditingPreset(preset);
    setForm(fillForm(preset));
    setFormOpen(true);
  };

  const openDuplicateForm = (preset: PresetConfig) => {
    setEditingPreset(null);
    setForm(
      fillForm(preset, {
        id: `${preset.id}-copy`,
        title: `${preset.title} (copy)`,
      }),
    );
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingPreset(null);
  };

  const guard = () => {
    if (canManage) return true;
    toast.error("Only Admin and Finance can change project blueprints.");
    return false;
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!guard()) return;
    const id = editingPreset?.id ?? slugify(form.id || form.title);
    if (!id || !form.title.trim() || !form.description.trim()) {
      toast.error("Blueprint ID, title and description are required.");
      return;
    }
    if (!editingPreset && presets.some((preset) => preset.id === id)) {
      toast.error("That blueprint ID already exists. Choose another ID.");
      return;
    }
    if (!Number.isFinite(form.durationValue) || form.durationValue <= 0) {
      toast.error("Duration must be greater than zero.");
      return;
    }

    setSaving(true);
    try {
      const preset: PresetConfig = {
        id,
        category: form.category,
        badge: form.badge.trim() || "Custom Blueprint",
        title: form.title.trim(),
        description: form.description.trim(),
        icon: <Sliders className="size-5" aria-hidden="true" />,
        defaultDurationValue: form.durationValue,
        defaultDurationUnit: form.durationUnit,
        suggestedRoles: parseRoles(form.suggestedRoles),
        ...(editingPreset?.techStack ? { techStack: editingPreset.techStack } : {}),
      };
      // Editing a standard blueprint writes this workspace's own copy of it, so the
      // first save of a built-in is an insert rather than an update.
      const alreadyStored = customPresetIds.has(id);
      await savePreset(preset, alreadyStored ? "update" : "create");
      await logActivity(companyId, alreadyStored ? "updated" : "created", "project_preset", id, {
        name: preset.title,
      });
      toast.success(alreadyStored ? "Blueprint updated." : "Blueprint saved to this workspace.");
      closeForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save blueprint.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (preset: PresetConfig) => {
    if (!guard()) return;
    try {
      await archivePreset(preset.id);
      await logActivity(companyId, "archived", "project_preset", preset.id, {
        name: preset.title,
      });
      toast.success(`"${preset.title}" archived. You can restore it at any time.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not archive blueprint.");
    }
  };

  const handleRestore = async (preset: PresetConfig) => {
    if (!guard()) return;
    try {
      await restorePreset(preset.id);
      toast.success(`"${preset.title}" restored.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not restore blueprint.");
    }
  };

  const handleResetToStandard = async (preset: PresetConfig) => {
    if (!guard()) return;
    if (!confirm(`Discard this workspace's changes to "${preset.title}" and use the standard one?`))
      return;
    try {
      await deletePreset(preset.id);
      toast.success("Reset to the standard blueprint.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset blueprint.");
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file || !guard()) return;
    try {
      const text = await file.text();
      const parsed = file.name.toLowerCase().endsWith(".csv")
        ? presetsFromCsvRows(fromCsv(text))
        : parsePresetJson(JSON.parse(text));
      const count = await importPresets(parsed.map(serializePreset));
      toast.success(`${count} blueprint${count === 1 ? "" : "s"} imported.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const exportJson = () => downloadJson("project-blueprints.json", presets.map(serializePreset));
  const exportCsv = () =>
    downloadCsv("project-blueprints.csv", presetsToCsvRows(presets), [...PRESET_CSV_COLUMNS]);

  const renderCard = (preset: PresetConfig, archived: boolean) => {
    const isCustom = customPresetIds.has(preset.id);
    return (
      <li key={preset.id} className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">
              <Sliders className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="font-display font-semibold leading-tight">{preset.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {preset.category} · {preset.defaultDurationValue} {preset.defaultDurationUnit}
              </p>
            </div>
          </div>
          <Badge variant={isCustom ? "secondary" : "outline"} className="shrink-0 text-xs">
            {archived ? "Archived" : isCustom ? "Edited here" : "Standard"}
          </Badge>
        </div>
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{preset.description}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">{preset.badge}</span>
          <div className="flex items-center gap-1">
            {archived ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => void handleRestore(preset)}
                disabled={!canManage}
              >
                <ArchiveRestore className="size-4" aria-hidden="true" />
                Restore
                <span className="sr-only">{preset.title}</span>
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditForm(preset)}
                  disabled={!canManage}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  <span className="sr-only">Edit {preset.title}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openDuplicateForm(preset)}
                  disabled={!canManage}
                >
                  <Copy className="size-4" aria-hidden="true" />
                  <span className="sr-only">Duplicate {preset.title}</span>
                </Button>
                {isCustom && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleResetToStandard(preset)}
                    disabled={!canManage}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    <span className="sr-only">Reset {preset.title} to standard</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void handleArchive(preset)}
                  disabled={!canManage}
                >
                  <Archive className="size-4" aria-hidden="true" />
                  <span className="sr-only">Archive {preset.title}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Project blueprints</h2>
          <p className="text-sm text-muted-foreground">
            {presets.length} available in the calculator. Every blueprint can be edited — changing a
            standard one saves this workspace&apos;s own copy without affecting anyone else.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            className="sr-only"
            onChange={(event) => void handleImportFile(event.target.files?.[0])}
          />
          <Button
            variant="outline"
            className="gap-2"
            disabled={!canManage}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden="true" /> Import
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportJson}>
            <Download className="size-4" aria-hidden="true" /> JSON
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="size-4" aria-hidden="true" /> CSV
          </Button>
          <Button onClick={openAddForm} disabled={!canManage} className="gap-2">
            <Plus className="size-4" aria-hidden="true" /> Add blueprint
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="blueprint-search" className="sr-only">
            Search project blueprints
          </label>
          <Input
            id="blueprint-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search project blueprints..."
            className="pl-9"
          />
        </div>
        <label htmlFor="blueprint-category" className="sr-only">
          Filter by category
        </label>
        <select
          id="blueprint-category"
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value as PresetCategory | "All")}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="All">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Loading blueprints…
        </p>
      ) : presets.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">No blueprints in this workspace yet</p>
          <p className="mt-1">
            Blueprints are stored in the database. Import a JSON or CSV file above, add one by hand,
            or run the catalogue seeder to load the standard set.
          </p>
        </div>
      ) : filteredPresets.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No project blueprints match your filters.
        </p>
      ) : (
        <ul className="grid list-none gap-3 p-0 md:grid-cols-2">
          {filteredPresets.map((preset) => renderCard(preset, false))}
        </ul>
      )}

      {archivedPresets.length > 0 && (
        <div className="space-y-3 border-t pt-4">
          <Button
            variant="ghost"
            className="gap-2 px-0 text-sm font-medium"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          >
            <Archive className="size-4" aria-hidden="true" />
            {showArchived ? "Hide" : "Show"} archived ({archivedPresets.length})
          </Button>
          {showArchived && (
            <ul className="grid list-none gap-3 p-0 md:grid-cols-2">
              {archivedPresets.map((preset) => renderCard(preset, true))}
            </ul>
          )}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingPreset ? "Edit project blueprint" : "Add project blueprint"}
            </DialogTitle>
            <DialogDescription>
              Define the project defaults shown in the calculator&apos;s Software Scope Blueprint
              selector.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Blueprint ID *</span>
                <Input
                  value={form.id}
                  disabled={!!editingPreset}
                  onChange={(event) => setForm({ ...form, id: event.target.value })}
                  placeholder="saas-mvp"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Title *</span>
                <Input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="SaaS MVP"
                  required
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Category</span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value as PresetCategory })
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Badge</span>
                <Input
                  value={form.badge}
                  onChange={(event) => setForm({ ...form, badge: event.target.value })}
                  placeholder="Custom Blueprint"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Duration</span>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={form.durationValue}
                    onChange={(event) =>
                      setForm({ ...form, durationValue: Number(event.target.value) })
                    }
                  />
                  <select
                    value={form.durationUnit}
                    onChange={(event) =>
                      setForm({ ...form, durationUnit: event.target.value as TimeUnit })
                    }
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                    aria-label="Duration unit"
                  >
                    {TIME_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Description *</span>
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="What does this project blueprint include?"
                className="min-h-24"
                required
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Suggested roles</span>
              <Textarea
                value={form.suggestedRoles}
                onChange={(event) => setForm({ ...form, suggestedRoles: event.target.value })}
                placeholder={"backend | Backend Developer | 100\ndesigner | UI/UX Designer | 50"}
                className="min-h-24 font-mono text-xs"
                aria-describedby="suggested-roles-hint"
              />
              <span id="suggested-roles-hint" className="text-xs text-muted-foreground">
                One per line: employee search text | role label | allocation percentage. Each
                person&apos;s allocations must total 100% or less of the project timeline.
              </span>
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingPreset ? "Update blueprint" : "Create blueprint"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
