import * as React from "react";
import { Sliders } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PresetConfig, PresetCategory } from "./types";
import type { TimeUnit } from "@/lib/pricing";

const PRESET_EVENT = "costcraft:preset-library";
const TIME_UNITS: TimeUnit[] = ["hours", "days", "weeks", "months"];
const CATEGORIES: PresetCategory[] = [
  "Mobile & Backend",
  "CMS & E-Commerce",
  "Business Systems",
  "AI & Automation",
  "Design & Creatives",
  "Startups & Custom",
];

type PresetJson = Omit<PresetConfig, "icon"> & { icon?: unknown };
type PresetRow = {
  id: string;
  config: unknown;
  company_id: string | null;
  archived_at: string | null;
};

function normalizePreset(value: unknown, index: number): PresetConfig {
  if (!value || typeof value !== "object") {
    throw new Error(`Preset ${index + 1} must be an object.`);
  }
  const preset = value as Partial<PresetJson>;
  const duration = Number(preset.defaultDurationValue);
  if (
    !preset.id ||
    !preset.title ||
    !preset.description ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    throw new Error(`Preset ${index + 1} needs id, title, description, and duration.`);
  }
  if (!TIME_UNITS.includes(preset.defaultDurationUnit as TimeUnit)) {
    throw new Error(`Preset ${preset.id} has an invalid defaultDurationUnit.`);
  }
  const category = CATEGORIES.includes(preset.category as PresetCategory)
    ? (preset.category as PresetCategory)
    : "Startups & Custom";
  const suggestedRoles = Array.isArray(preset.suggestedRoles) ? preset.suggestedRoles : [];
  const normalizedRoles = suggestedRoles.map((role, roleIndex) => {
    if (!role || typeof role !== "object" || !String(role.nameSubstr || "").trim()) {
      throw new Error(`Preset ${preset.id} role ${roleIndex + 1} needs employee search text.`);
    }
    const allocationPct = Number(role.allocationPct);
    if (!Number.isFinite(allocationPct) || allocationPct < 0 || allocationPct > 100) {
      throw new Error(`Preset ${preset.id} role ${roleIndex + 1} allocation must be 0–100%.`);
    }
    return {
      nameSubstr: String(role.nameSubstr).trim(),
      label: String(role.label || role.nameSubstr || "Role").trim(),
      allocationPct,
    };
  });
  return {
    ...(preset as Omit<PresetConfig, "icon">),
    id: String(preset.id),
    category,
    badge: String(preset.badge || "Custom"),
    title: String(preset.title),
    description: String(preset.description),
    icon: <Sliders className="size-5 text-foreground" />,
    defaultDurationValue: duration,
    defaultDurationUnit: preset.defaultDurationUnit as TimeUnit,
    suggestedRoles: normalizedRoles,
  };
}

export const PRESET_CSV_COLUMNS = [
  "id",
  "category",
  "badge",
  "title",
  "description",
  "defaultDurationValue",
  "defaultDurationUnit",
  "suggestedRoles",
  "techStack",
] as const;

/** Flat one-row-per-blueprint view; the two nested lists ride along as JSON cells. */
export function presetsToCsvRows(list: PresetConfig[]): Record<string, string>[] {
  return list.map((preset) => ({
    id: preset.id,
    category: preset.category,
    badge: preset.badge ?? "",
    title: preset.title,
    description: preset.description,
    defaultDurationValue: String(preset.defaultDurationValue),
    defaultDurationUnit: preset.defaultDurationUnit,
    suggestedRoles: JSON.stringify(preset.suggestedRoles ?? []),
    techStack: JSON.stringify(preset.techStack ?? []),
  }));
}

export function presetsFromCsvRows(rows: Record<string, string>[]): PresetConfig[] {
  if (!rows.length) throw new Error("The CSV has no data rows.");
  const parseCell = (raw: string | undefined, label: string, rowNo: number) => {
    if (!raw || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      return parsed;
    } catch {
      throw new Error(`Row ${rowNo}: "${label}" must be a JSON array.`);
    }
  };
  return rows.map((row, i) =>
    normalizePreset(
      {
        ...row,
        defaultDurationValue: Number(row["defaultDurationValue"]),
        suggestedRoles: parseCell(row["suggestedRoles"], "suggestedRoles", i + 2),
        techStack: parseCell(row["techStack"], "techStack", i + 2),
      },
      i,
    ),
  );
}

export function parsePresetJson(value: unknown): PresetConfig[] {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { presets?: unknown }).presets)
      ? (value as { presets: unknown[] }).presets
      : null;
  if (!list?.length) throw new Error("JSON must contain a non-empty presets array.");
  return list.map(normalizePreset);
}

export function serializePreset({ icon: _icon, ...preset }: PresetConfig): Record<string, unknown> {
  return preset as unknown as Record<string, unknown>;
}

/** A workspace's own copy of a template overrides the shared master of the same id. */
function mergePresets(
  masters: PresetConfig[],
  customPresets: PresetConfig[],
  archived: Set<string>,
): PresetConfig[] {
  const customById = new Map(customPresets.map((preset) => [preset.id, preset]));
  const visibleMasters = masters
    .filter((preset) => !archived.has(preset.id))
    .map((preset) => customById.get(preset.id) ?? preset);
  const customOnly = customPresets.filter(
    (preset) => !masters.some((master) => master.id === preset.id),
  );
  return [...visibleMasters, ...customOnly];
}

export function usePresetLibrary(companyId?: string) {
  const [presets, setPresets] = React.useState<PresetConfig[]>([]);
  const [customPresetIds, setCustomPresetIds] = React.useState<Set<string>>(new Set());
  const [archivedPresets, setArchivedPresets] = React.useState<PresetConfig[]>([]);
  const [archivedIds, setArchivedIds] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);

  const loadPresets = React.useCallback(async () => {
    setLoading(true);
    // Templates live in the database, never in the bundle. A row with no company_id
    // is a shared master; a row with one is this workspace's editable copy of it.
    // Two queries rather than .or(), which the local backend adapter does not support.
    const fetchRows = async (withArchived: boolean) => {
      const columns = withArchived
        ? "id, config, company_id, archived_at"
        : "id, config, company_id";
      const master = await supabase.from("project_presets").select(columns).is("company_id", null);
      const tenant = companyId
        ? await supabase.from("project_presets").select(columns).eq("company_id", companyId)
        : { data: [], error: null };
      return {
        data: [...((master.data as unknown[]) ?? []), ...((tenant.data as unknown[]) ?? [])],
        error: master.error ?? tenant.error,
      };
    };

    // archived_at and a nullable company_id arrive with a migration; until it is
    // applied, read the older shape so a workspace still sees its blueprints.
    let { data, error } = await fetchRows(true);
    if (error) ({ data, error } = await fetchRows(false));

    if (error) {
      console.warn("Failed to load project blueprints:", error.message);
      setPresets([]);
      setCustomPresetIds(new Set());
      setArchivedPresets([]);
      setArchivedIds(new Set());
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as PresetRow[];
    const safeNormalize = (row: PresetRow, index: number) => {
      try {
        return normalizePreset({ ...(row.config as object), id: row.id }, index);
      } catch {
        // A malformed stored row must not blank the whole library.
        return null;
      }
    };

    const masterRows = rows.filter((row) => row.company_id === null);
    const tenantRows = rows.filter((row) => row.company_id !== null);
    const live = tenantRows.filter((row) => !row.archived_at);
    const archived = tenantRows.filter((row) => Boolean(row.archived_at));

    setCustomPresetIds(new Set(live.map((row) => row.id)));
    setArchivedIds(new Set(archived.map((row) => row.id)));

    const masters = masterRows.map(safeNormalize).filter(Boolean) as PresetConfig[];
    const custom = live.map(safeNormalize).filter(Boolean) as PresetConfig[];
    const archivedIdSet = new Set(archived.map((row) => row.id));
    setArchivedPresets(archived.map(safeNormalize).filter(Boolean) as PresetConfig[]);
    setPresets(mergePresets(masters, custom, archivedIdSet));
    setLoading(false);
  }, [companyId]);

  React.useEffect(() => {
    void loadPresets();
    window.addEventListener(PRESET_EVENT, loadPresets);
    return () => window.removeEventListener(PRESET_EVENT, loadPresets);
  }, [loadPresets]);

  const importPresets = async (value: unknown) => {
    if (!companyId) throw new Error("A company workspace is required to manage presets.");
    const imported = parsePresetJson(value);
    const { error } = await supabase.from("project_presets").upsert(
      imported.map((preset) => ({
        id: preset.id,
        company_id: companyId,
        config: serializePreset(preset),
      })) as never,
    );
    if (error) throw error;
    await loadPresets();
    window.dispatchEvent(new Event(PRESET_EVENT));
    return imported.length;
  };

  const deletePreset = async (id: string) => {
    if (!companyId) return;
    const { error } = await supabase
      .from("project_presets")
      .delete()
      .eq("company_id", companyId)
      .eq("id", id);
    if (error) throw error;
    await loadPresets();
    window.dispatchEvent(new Event(PRESET_EVENT));
  };

  const savePreset = async (preset: PresetConfig, mode: "create" | "update" = "create") => {
    if (!companyId) throw new Error("A company workspace is required to manage presets.");
    const payload = { config: serializePreset(preset) } as never;
    const { error } =
      mode === "update"
        ? await supabase
            .from("project_presets")
            .update(payload)
            .eq("company_id", companyId)
            .eq("id", preset.id)
        : await supabase.from("project_presets").insert({
            id: preset.id,
            company_id: companyId,
            config: serializePreset(preset),
          } as never);
    if (error) throw error;
    await loadPresets();
    window.dispatchEvent(new Event(PRESET_EVENT));
  };

  const resetPresets = async () => {
    if (!companyId) return;
    const { error } = await supabase.from("project_presets").delete().eq("company_id", companyId);
    if (error) throw error;
    await loadPresets();
    window.dispatchEvent(new Event(PRESET_EVENT));
  };

  const archivePreset = async (id: string) => {
    if (!companyId) return;
    // Archiving a built-in stores an archived override row so the tenant's choice sticks.
    const payload = {
      id,
      company_id: companyId,
      config: serializePreset(
        presets.find((preset) => preset.id === id) ?? ({ id } as PresetConfig),
      ),
      archived_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("project_presets").upsert(payload as never);
    if (error) throw error;
    await loadPresets();
    window.dispatchEvent(new Event(PRESET_EVENT));
  };

  const restorePreset = async (id: string) => {
    if (!companyId) return;
    const { error } = await supabase
      .from("project_presets")
      .update({ archived_at: null } as never)
      .eq("company_id", companyId)
      .eq("id", id);
    if (error) throw error;
    await loadPresets();
    window.dispatchEvent(new Event(PRESET_EVENT));
  };

  return {
    presets,
    loading,
    archivedPresets,
    archivedIds,
    customPresetIds,
    importPresets,
    savePreset,
    archivePreset,
    restorePreset,
    deletePreset,
    resetPresets,
  };
}
