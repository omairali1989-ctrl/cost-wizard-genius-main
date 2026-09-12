// ─── PresetSelector ───────────────────────────────────────────────────────────
// Scope card grid + category filter pills + search bar
import * as React from "react";
import { CheckCircle2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PresetCategory, PresetConfig, ProjectPresetId } from "./types";
import { PRESET_CATEGORIES } from "./types";

interface PresetSelectorProps {
  selectedPreset: ProjectPresetId;
  onSelect: (preset: PresetConfig) => void;
  presets: PresetConfig[];
}

export const PresetSelector = React.memo(function PresetSelector({
  selectedPreset,
  onSelect,
  presets,
}: PresetSelectorProps) {
  const [selectedCategory, setSelectedCategory] =
    React.useState<PresetCategory>("All");
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredPresets = React.useMemo(() => {
    return presets.filter((p) => {
      const matchCat =
        selectedCategory === "All" || p.category === selectedCategory;
      const matchSearch =
        !searchQuery ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.badge.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [presets, selectedCategory, searchQuery]);

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <Label className="text-sm font-semibold">1. Choose Software Scope</Label>
          <p className="text-xs text-muted-foreground">
            Select a software query template (MVP, Mobile, Web, CMS, Shopify, Creatives) or customize
          </p>
        </div>
        <div className="relative w-full sm:w-52">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="h-8 pl-8 text-xs bg-card"
          />
        </div>
      </div>

      {/* Category pill filters */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        {PRESET_CATEGORIES.map((cat) => {
          const count =
            cat === "All"
              ? presets.length
              : presets.filter((p) => p.category === cat).length;
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                  : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{cat}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Preset card grid */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 max-h-[440px] overflow-y-auto pr-1">
        {filteredPresets.map((preset) => {
          const isSelected = selectedPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset)}
              className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="p-1.5 rounded-lg bg-background border shadow-2xs">
                    {preset.icon}
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    {preset.badge}
                  </span>
                </div>
                {isSelected ? (
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                ) : (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    ⏱️ {preset.defaultDurationValue} {preset.defaultDurationUnit}
                  </span>
                )}
              </div>
              <span className="font-semibold text-sm leading-tight mt-0.5">
                {preset.title}
              </span>
              <span className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
