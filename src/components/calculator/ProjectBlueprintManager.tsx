import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Search, Sliders, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/workspace";
import { PRESET_CATEGORIES, type PresetCategory, type PresetConfig } from "./qce/types";
import { usePresetLibrary } from "./qce/presetLibrary";
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
  return value
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
}

interface ProjectBlueprintManagerProps {
  companyId: string;
  canManage: boolean;
}

export function ProjectBlueprintManager({ companyId, canManage }: ProjectBlueprintManagerProps) {
  const { presets, customPresetIds, savePreset, deletePreset } = usePresetLibrary(companyId);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PresetCategory | "All">("All");
  const [formOpen, setFormOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetConfig | null>(null);
  const [form, setForm] = useState<BlueprintForm>(createForm());
  const [saving, setSaving] = useState(false);

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

  const openEditForm = (preset: PresetConfig) => {
    setEditingPreset(preset);
    setForm({
      id: preset.id,
      title: preset.title,
      category: preset.category,
      badge: preset.badge,
      description: preset.description,
      durationValue: preset.defaultDurationValue,
      durationUnit: preset.defaultDurationUnit,
      suggestedRoles: roleText(preset),
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingPreset(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) {
      toast.error("Only Admin and Finance can change project blueprints.");
      return;
    }
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
        icon: <Sliders className="size-5 text-slate-500" />,
        defaultDurationValue: form.durationValue,
        defaultDurationUnit: form.durationUnit,
        suggestedRoles: parseRoles(form.suggestedRoles),
        ...(editingPreset?.techStack ? { techStack: editingPreset.techStack } : {}),
      };
      await savePreset(preset, editingPreset ? "update" : "create");
      await logActivity(companyId, editingPreset ? "updated" : "created", "project_preset", id, {
        name: preset.title,
      });
      toast.success(editingPreset ? "Blueprint updated." : "Blueprint created.");
      closeForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save blueprint.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (preset: PresetConfig) => {
    if (!canManage || !customPresetIds.has(preset.id)) return;
    if (!confirm(`Delete "${preset.title}" from this workspace?`)) return;
    try {
      await deletePreset(preset.id);
      await logActivity(companyId, "deleted", "project_preset", preset.id, { name: preset.title });
      toast.success("Blueprint deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete blueprint.");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Project blueprints</h2>
          <p className="text-sm text-muted-foreground">
            {presets.length} blueprints are available in the calculator. Built-ins are read-only;
            custom workspace blueprints can be changed.
          </p>
        </div>
        <Button onClick={openAddForm} disabled={!canManage} className="gap-2">
          <Plus className="size-4" /> Add blueprint
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search project blueprints..."
            className="pl-9"
          />
        </div>
        <select
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

      {filteredPresets.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No project blueprints match your filters.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredPresets.map((preset) => {
            const isCustom = customPresetIds.has(preset.id);
            return (
              <div key={preset.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-muted p-2">{preset.icon}</div>
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold leading-tight">{preset.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {preset.category} · {preset.defaultDurationValue}{" "}
                        {preset.defaultDurationUnit}
                      </p>
                    </div>
                  </div>
                  <Badge variant={isCustom ? "secondary" : "outline"} className="shrink-0 text-xs">
                    {isCustom ? "Custom" : "Standard"}
                  </Badge>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                  {preset.description}
                </p>
                <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
                  <span className="text-xs text-muted-foreground">{preset.badge}</span>
                  {isCustom && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditForm(preset)}
                        disabled={!canManage}
                        title={`Edit ${preset.title}`}
                      >
                        <Pencil className="size-4" />
                        <span className="sr-only">Edit {preset.title}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleDelete(preset)}
                        disabled={!canManage}
                        title={`Delete ${preset.title}`}
                      >
                        <Trash2 className="size-4 text-red-500" />
                        <span className="sr-only">Delete {preset.title}</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
                placeholder="Hassnain | Fullstack Developer | 100\nYousuf | UI/UX Designer | 50"
                className="min-h-24 font-mono text-xs"
              />
              <span className="text-xs text-muted-foreground">
                One per line: employee search text | role label | allocation percentage.
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
