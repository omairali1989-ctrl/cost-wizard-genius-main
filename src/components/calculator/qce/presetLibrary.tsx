import * as React from "react";
import { Sliders } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PRESETS } from "./presets";
import type { PresetConfig, PresetCategory } from "./types";
import type { TimeUnit } from "@/lib/pricing";

const PRESET_EVENT = "costcraft:preset-library";
const TIME_UNITS: TimeUnit[] = ["hours", "days", "weeks", "months"];
const CATEGORIES: PresetCategory[] = [
  "Mobile & Backend",
  "CMS & E-Commerce",
  "Design & Creatives",
  "Startups & Custom",
];

type PresetJson = Omit<PresetConfig, "icon"> & { icon?: unknown };
type PresetRow = { id: string; config: unknown };

function normalizePreset(value: unknown, index: number): PresetConfig {
  if (!value || typeof value !== "object") {
    throw new Error(`Preset ${index + 1} must be an object.`);
  }
  const preset = value as Partial<PresetJson>;
  if (!preset.id || !preset.title || !preset.description) {
    throw new Error(`Preset ${index + 1} needs id, title, and description.`);
  }
  if (!TIME_UNITS.includes(preset.defaultDurationUnit as TimeUnit)) {
    throw new Error(`Preset ${preset.id} has an invalid defaultDurationUnit.`);
  }
  const category = CATEGORIES.includes(preset.category as PresetCategory)
    ? (preset.category as PresetCategory)
    : "Startups & Custom";
  const suggestedRoles = Array.isArray(preset.suggestedRoles) ? preset.suggestedRoles : [];
  return {
    ...(preset as Omit<PresetConfig, "icon">),
    id: String(preset.id),
    category,
    badge: String(preset.badge || "Custom"),
    title: String(preset.title),
    description: String(preset.description),
    icon: <Sliders className="size-5 text-slate-500" />,
    defaultDurationValue: Number(preset.defaultDurationValue) || 1,
    defaultDurationUnit: preset.defaultDurationUnit as TimeUnit,
    suggestedRoles: suggestedRoles.map((role) => ({
      nameSubstr: String(role.nameSubstr || ""),
      label: String(role.label || role.nameSubstr || "Role"),
      allocationPct: Number(role.allocationPct) || 0,
    })),
  };
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

function serializePreset({ icon: _icon, ...preset }: PresetConfig): Record<string, unknown> {
  return preset as unknown as Record<string, unknown>;
}

function mergePresets(customPresets: PresetConfig[]): PresetConfig[] {
  const customById = new Map(customPresets.map((preset) => [preset.id, preset]));
  const builtIns = PRESETS.map((preset) => customById.get(preset.id) ?? preset);
  const customOnly = customPresets.filter((preset) => !PRESETS.some((builtIn) => builtIn.id === preset.id));
  return [...builtIns, ...customOnly];
}

export function usePresetLibrary(companyId?: string) {
  const [presets, setPresets] = React.useState<PresetConfig[]>(PRESETS);

  const loadPresets = React.useCallback(async () => {
    if (!companyId) {
      setPresets(PRESETS);
      return;
    }
    const { data, error } = await supabase
      .from("project_presets")
      .select("id, config")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });
    if (error) {
      console.warn("Failed to load project presets:", error.message);
      setPresets(PRESETS);
      return;
    }
    const custom = ((data ?? []) as unknown as PresetRow[]).map((row, index) =>
      normalizePreset({ ...(row.config as object), id: row.id }, index),
    );
    setPresets(mergePresets(custom));
  }, [companyId]);

  React.useEffect(() => {
    void loadPresets();
    window.addEventListener(PRESET_EVENT, loadPresets);
    return () => window.removeEventListener(PRESET_EVENT, loadPresets);
  }, [loadPresets]);

  const importPresets = async (value: unknown) => {
    if (!companyId) throw new Error("A company workspace is required to manage presets.");
    const imported = parsePresetJson(value);
    const ids = imported.map((preset) => preset.id);
    const { error: deleteError } = await supabase
      .from("project_presets")
      .delete()
      .eq("company_id", companyId)
      .in("id", ids);
    if (deleteError) throw deleteError;
    const { error } = await supabase.from("project_presets").insert(
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

  const resetPresets = async () => {
    if (!companyId) return;
    const { error } = await supabase.from("project_presets").delete().eq("company_id", companyId);
    if (error) throw error;
    setPresets(PRESETS);
    window.dispatchEvent(new Event(PRESET_EVENT));
  };

  return { presets, importPresets, deletePreset, resetPresets };
}
import * as React from "react";
import { Sliders } from "lucide-react";
import { PRESETS } from "./presets";
import type { PresetConfig, PresetCategory } from "./types";
import type { TimeUnit } from "@/lib/pricing";

const STORAGE_KEY = "costcraft.preset-library";
const TIME_UNITS: TimeUnit[] = ["hours", "days", "weeks", "months"];
const CATEGORIES: PresetCategory[] = [
  "Mobile & Backend",
  "CMS & E-Commerce",
  "Design & Creatives",
  "Startups & Custom",
];

type PresetJson = Omit<PresetConfig, "icon"> & { icon?: unknown };

function normalizePreset(value: unknown, index: number): PresetConfig {
  if (!value || typeof value !== "object")
    throw new Error(`Preset ${index + 1} must be an object.`);
  const preset = value as Partial<PresetJson>;
  if (!preset.id || !preset.title || !preset.description) {
    throw new Error(`Preset ${index + 1} needs id, title, and description.`);
  }
  if (!TIME_UNITS.includes(preset.defaultDurationUnit as TimeUnit)) {
    throw new Error(`Preset ${preset.id} has an invalid defaultDurationUnit.`);
  }
  const category = CATEGORIES.includes(preset.category as PresetCategory)
    ? (preset.category as PresetCategory)
    : "Startups & Custom";
  const suggestedRoles = Array.isArray(preset.suggestedRoles) ? preset.suggestedRoles : [];
  return {
    ...(preset as Omit<PresetConfig, "icon">),
    id: String(preset.id),
    category,
    badge: String(preset.badge || "Custom"),
    title: String(preset.title),
    description: String(preset.description),
    icon: <Sliders className="size-5 text-slate-500" />,
    defaultDurationValue: Number(preset.defaultDurationValue) || 1,
    defaultDurationUnit: preset.defaultDurationUnit as TimeUnit,
    suggestedRoles: suggestedRoles.map((role) => ({
      nameSubstr: String(role.nameSubstr || ""),
      label: String(role.label || role.nameSubstr || "Role"),
      allocationPct: Number(role.allocationPct) || 0,
    })),
  };
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

function readStoredPresets(): PresetConfig[] {
  if (typeof window === "undefined") return PRESETS;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return PRESETS;
  try {
    return parsePresetJson(JSON.parse(stored));
  } catch {
    return PRESETS;
  }
}

export function savePresetLibrary(presets: PresetConfig[]): void {
  const serializable = presets.map(({ icon: _icon, ...preset }) => preset);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  window.dispatchEvent(new Event("costcraft:preset-library"));
}

export function usePresetLibrary() {
  const [presets, setPresets] = React.useState<PresetConfig[]>(PRESETS);

  React.useEffect(() => {
    const refresh = () => setPresets(readStoredPresets());
    refresh();
    window.addEventListener("costcraft:preset-library", refresh);
    return () => window.removeEventListener("costcraft:preset-library", refresh);
  }, []);

  return {
    presets,
    importPresets: (value: unknown) => {
      const imported = parsePresetJson(value);
      savePresetLibrary(imported);
      setPresets(imported);
      return imported.length;
    },
    resetPresets: () => {
      window.localStorage.removeItem(STORAGE_KEY);
      setPresets(PRESETS);
      window.dispatchEvent(new Event("costcraft:preset-library"));
    },
  };
}
