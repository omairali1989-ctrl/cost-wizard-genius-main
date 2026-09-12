// ─── ScopeEngine ──────────────────────────────────────────────────────────────
// Interactive feature-selection wizard with database persistence and drag-and-drop.
// Features load dynamically from Supabase (scope_features), can be dragged into scope
// or specific phase drop zones, and customized with live team rate calculations.
import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Filter,
  Clock,
  Users,
  AlertTriangle,
  Info,
  GripVertical,
  PlusCircle,
  Trash2,
  FolderPlus,
  Layers,
  Search,
  BookOpen,
} from "lucide-react";
import { FeatureLibraryManager } from "./FeatureLibraryManager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/pricing";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useScopeFeatures,
  type ScopeFeatureRecord,
  type TeamRate,
} from "@/lib/workspace";
import {
  FEATURE_LIBRARY,
  CATEGORY_META,
  COMPLEXITY_LABELS,
  ROLE_LABELS,
  ROLE_KEYS,
  type Complexity,
  type FeatureCategory,
  type FeatureDefinition,
  type FeatureEffort,
  type RoleKey,
} from "./featureLibrary";
import type { CalculationInputs } from "@/lib/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────
export type TargetPhase = "design" | "dev" | "qa" | "auto";

interface SelectedFeature {
  featureId: string;
  complexity: Complexity;
  quantity: number;
  targetPhase?: TargetPhase | undefined;
}

interface EffortSummary {
  role: RoleKey;
  hours: number;
  cost: number;
}

interface ScopeEngineProps {
  companyId?: string;
  projectName?: string;
  employees: TeamRate[];
  currency: string;
  marginPct: number;
  salesCommissionPct: number;
  contingencyPct: number;
  onApply: (inputs: Partial<CalculationInputs>) => void;
}

// ─── Role → employee matcher ──────────────────────────────────────────────────
function matchEmployeeForRole(
  role: RoleKey,
  employees: TeamRate[]
): TeamRate | undefined {
  const kw: Record<RoleKey, string[]> = {
    designer: ["design", "ui", "ux", "figma", "creative"],
    frontend: ["frontend", "front-end", "react", "mern", "next", "vue"],
    backend:  ["backend", "back-end", "laravel", "php", "node", "api", "mern"],
    mobile:   ["mobile", "flutter", "react native", "android", "ios", "app"],
    pm:       ["project manager", "pm", "manager", "lead", "director"],
    qa:       ["qa", "quality", "test", "tester"],
  };
  const words = kw[role];
  return employees.find((e) => {
    const hay = `${e.name} ${e.job_title ?? ""} ${e.department ?? ""}`.toLowerCase();
    return words.some((w) => hay.includes(w));
  });
}

// ─── Calculate total effort from selections ───────────────────────────────────
function calcEffort(
  selections: SelectedFeature[],
  library: FeatureDefinition[],
  employees: TeamRate[]
): { byRole: EffortSummary[]; totalHours: number; totalCost: number } {
  const roleHours: Record<RoleKey, number> = {
    designer: 0, frontend: 0, backend: 0, mobile: 0, pm: 0, qa: 0,
  };

  for (const sel of selections) {
    const feat = library.find((f) => f.id === sel.featureId);
    if (!feat) continue;
    const effort = feat.effort[sel.complexity];
    if (!effort) continue;
    for (const rk of ROLE_KEYS) {
      roleHours[rk] += (effort[rk] ?? 0) * sel.quantity;
    }
  }

  const byRole: EffortSummary[] = ROLE_KEYS.map((rk) => {
    const emp = matchEmployeeForRole(rk, employees);
    const cost = (emp?.hourly_cost ?? 0) * roleHours[rk];
    return { role: rk, hours: roleHours[rk], cost };
  });

  const totalHours = byRole.reduce((s, r) => s + r.hours, 0);
  const totalCost = byRole.reduce((s, r) => s + r.cost, 0);

  return { byRole, totalHours, totalCost };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const ScopeEngine = React.memo(function ScopeEngine({
  companyId,
  projectName: initialProjectName,
  employees,
  currency,
  marginPct,
  salesCommissionPct,
  contingencyPct,
  onApply,
}: ScopeEngineProps) {
  const queryClient = useQueryClient();
  const { data: dbFeatures = [], isLoading: isLoadingFeatures } = useScopeFeatures(companyId);

  // Merge features: DB takes precedence, fallback to default library
  const library: FeatureDefinition[] = React.useMemo(() => {
    if (dbFeatures && dbFeatures.length > 0) {
      return dbFeatures.map((f) => ({
        id: f.id,
        category: (f.category as FeatureCategory) || "frontend",
        label: f.label,
        description: f.description ?? "",
        effort: f.effort,
        icon: f.icon || "⚡",
        tags: Array.isArray(f.tags) ? f.tags : [],
        isCustom: f.is_custom,
      })) as (FeatureDefinition & { isCustom?: boolean })[];
    }
    return FEATURE_LIBRARY;
  }, [dbFeatures]);

  const [selections, setSelections] = React.useState<SelectedFeature[]>([]);
  const [activeCategory, setActiveCategory] = React.useState<FeatureCategory | "all">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedCategories, setExpandedCategories] = React.useState<Set<FeatureCategory>>(
    new Set(["discovery", "design", "frontend", "backend", "mobile"])
  );
  const [projectName, setProjectName] = React.useState(initialProjectName || "Scope Engine Estimate");

  React.useEffect(() => {
    if (initialProjectName && initialProjectName.trim()) {
      setProjectName(initialProjectName);
    }
  }, [initialProjectName]);

  // Drag-and-Drop state
  const [draggingFeatureId, setDraggingFeatureId] = React.useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = React.useState<string | null>(null);

  // New Custom Feature Modal
  const [isLibraryManagerOpen, setIsLibraryManagerOpen] = React.useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [savingFeature, setSavingFeature] = React.useState(false);
  const [newFeature, setNewFeature] = React.useState({
    label: "",
    category: "frontend" as FeatureCategory,
    description: "",
    icon: "⚡",
    tags: "custom, feature",
    designer: 8,
    frontend: 16,
    backend: 16,
    mobile: 0,
    pm: 4,
    qa: 4,
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedIds = React.useMemo(
    () => new Set(selections.map((s) => s.featureId)),
    [selections]
  );

  const effort = React.useMemo(
    () => calcEffort(selections, library, employees),
    [selections, library, employees]
  );

  const contingencyAmt = effort.totalCost * (contingencyPct / 100);
  const totalWithContingency = effort.totalCost + contingencyAmt;
  const m = Math.min(marginPct, 90) / 100;
  const price = m >= 1 ? totalWithContingency : totalWithContingency / (1 - m);
  const commission = price * (salesCommissionPct / 100);
  const netProfit = price - totalWithContingency - commission;

  // Categories present in library
  const allCategories = React.useMemo(() => {
    const set = new Set(library.map((f) => f.category));
    return Array.from(set) as FeatureCategory[];
  }, [library]);

  const visibleFeatures = React.useMemo(() => {
    return library.filter((f) => {
      const matchCat = activeCategory === "all" || f.category === activeCategory;
      const matchSearch =
        !searchQuery.trim() ||
        f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [library, activeCategory, searchQuery]);

  // Group by category
  const grouped = React.useMemo(() => {
    const map = new Map<FeatureCategory, FeatureDefinition[]>();
    for (const f of visibleFeatures) {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category)!.push(f);
    }
    return map;
  }, [visibleFeatures]);

  // ── Drag & Drop Handlers ───────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, featureId: string) => {
    e.dataTransfer.setData("text/plain", featureId);
    e.dataTransfer.setData("application/json", JSON.stringify({ featureId }));
    e.dataTransfer.effectAllowed = "copyMove";
    setDraggingFeatureId(featureId);
  };

  const handleDragEnd = () => {
    setDraggingFeatureId(null);
    setDragOverTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, targetName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (dragOverTarget !== targetName) {
      setDragOverTarget(targetName);
    }
  };

  const handleDragLeave = (e: React.DragEvent, targetName: string) => {
    if (dragOverTarget === targetName) {
      setDragOverTarget(null);
    }
  };

  const handleDrop = (e: React.DragEvent, phase: TargetPhase) => {
    e.preventDefault();
    setDragOverTarget(null);
    const featureId = e.dataTransfer.getData("text/plain");
    if (!featureId) return;

    addFeature(featureId, "medium", phase);
  };

  // ── Feature Action Handlers ────────────────────────────────────────────────
  function addFeature(featureId: string, complexity: Complexity = "medium", phase: TargetPhase = "auto") {
    setSelections((prev) => {
      const exists = prev.find((s) => s.featureId === featureId);
      if (exists) {
        // Increment quantity if dropped or added again
        toast.info(`Increased quantity for feature.`);
        return prev.map((s) =>
          s.featureId === featureId
            ? { ...s, quantity: s.quantity + 1, targetPhase: phase !== "auto" ? phase : s.targetPhase }
            : s
        );
      }
      toast.success(`Added feature to project scope!`);
      return [...prev, { featureId, complexity, quantity: 1, targetPhase: phase }];
    });
  }

  function toggleFeature(featureId: string) {
    setSelections((prev) => {
      if (prev.some((s) => s.featureId === featureId)) {
        return prev.filter((s) => s.featureId !== featureId);
      }
      return [...prev, { featureId, complexity: "medium", quantity: 1, targetPhase: "auto" }];
    });
  }

  function updateSelection(
    featureId: string,
    patch: Partial<Omit<SelectedFeature, "featureId">>
  ) {
    setSelections((prev) =>
      prev.map((s) => (s.featureId === featureId ? { ...s, ...patch } : s))
    );
  }

  function toggleCategory(cat: FeatureCategory) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  // ── Save Custom Feature to DB ──────────────────────────────────────────────
  async function handleSaveCustomFeature(e: React.FormEvent) {
    e.preventDefault();
    if (!newFeature.label.trim()) {
      toast.error("Please provide a feature name.");
      return;
    }

    setSavingFeature(true);
    try {
      const featureId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const tagsArray = newFeature.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const baseEffort: FeatureEffort = {
        designer: Number(newFeature.designer) || 0,
        frontend: Number(newFeature.frontend) || 0,
        backend:  Number(newFeature.backend) || 0,
        mobile:   Number(newFeature.mobile) || 0,
        pm:       Number(newFeature.pm) || 0,
        qa:       Number(newFeature.qa) || 0,
      };

      const fullEffort: Record<Complexity, FeatureEffort> = {
        low: {
          designer: Math.round(baseEffort.designer * 0.5),
          frontend: Math.round(baseEffort.frontend * 0.5),
          backend:  Math.round(baseEffort.backend * 0.5),
          mobile:   Math.round(baseEffort.mobile * 0.5),
          pm:       Math.round(baseEffort.pm * 0.5),
          qa:       Math.round(baseEffort.qa * 0.5),
        },
        medium: baseEffort,
        high: {
          designer: Math.round(baseEffort.designer * 2),
          frontend: Math.round(baseEffort.frontend * 2),
          backend:  Math.round(baseEffort.backend * 2),
          mobile:   Math.round(baseEffort.mobile * 2),
          pm:       Math.round(baseEffort.pm * 2),
          qa:       Math.round(baseEffort.qa * 2),
        },
      };

      const record: Partial<ScopeFeatureRecord> = {
        id: featureId,
        company_id: companyId ?? null,
        category: newFeature.category,
        label: newFeature.label.trim(),
        description: newFeature.description.trim(),
        effort: fullEffort,
        icon: newFeature.icon || "⚡",
        tags: tagsArray,
        sort_order: 999,
        is_custom: true,
      };

      const { error } = await supabase.from("scope_features").insert(record);
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["scope-features"] });
      toast.success("✨ New feature added to your company's library!");
      setIsAddModalOpen(false);

      // Automatically add it to the active scope
      addFeature(featureId, "medium", "auto");
    } catch (err: any) {
      console.error("Failed to save feature:", err);
      toast.error(`Error saving feature: ${err?.message || "Unknown error"}`);
    } finally {
      setSavingFeature(false);
    }
  }

  // ── Delete Custom Feature from DB ──────────────────────────────────────────
  async function handleDeleteCustomFeature(featureId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to remove this custom feature from the library?")) return;

    try {
      const { error } = await supabase.from("scope_features").delete().eq("id", featureId);
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["scope-features"] });
      setSelections((prev) => prev.filter((s) => s.featureId !== featureId));
      toast.success("Feature removed from library.");
    } catch (err: any) {
      console.error("Failed to delete feature:", err);
      toast.error(`Could not delete feature: ${err.message}`);
    }
  }

  // ── Build inputs and apply ─────────────────────────────────────────────────
  function handleApply() {
    const designPhase = {
      id: "phase-scope-design",
      name: "Design & Discovery",
      allocations: [] as CalculationInputs["phases"][number]["allocations"],
    };
    const devPhase = {
      id: "phase-scope-dev",
      name: "Development",
      allocations: [] as CalculationInputs["phases"][number]["allocations"],
    };
    const qaPhase = {
      id: "phase-scope-qa",
      name: "QA, Testing & Launch",
      allocations: [] as CalculationInputs["phases"][number]["allocations"],
    };

    const rolePhaseMap: Record<RoleKey, typeof designPhase> = {
      designer: designPhase,
      pm:       designPhase,
      frontend: devPhase,
      backend:  devPhase,
      mobile:   devPhase,
      qa:       qaPhase,
    };

    for (const e of effort.byRole) {
      if (e.hours <= 0) continue;
      const emp = matchEmployeeForRole(e.role, employees);
      const phase = rolePhaseMap[e.role];
      phase.allocations.push({
        id: `alloc-scope-${e.role}`,
        employeeId: emp?.id ?? null,
        label: `${ROLE_LABELS[e.role].label}${emp ? ` (${emp.name})` : ""}`,
        hours: Math.round(e.hours),
        hourlyCost: emp?.hourly_cost ?? 0,
      });
    }

    const phases = [designPhase, devPhase, qaPhase].filter(
      (p) => p.allocations.length > 0
    );

    const featureList = selections
      .map((s) => {
        const f = library.find((x) => x.id === s.featureId);
        return f ? `${f.icon} ${f.label} (${COMPLEXITY_LABELS[s.complexity].label}${s.quantity > 1 ? ` ×${s.quantity}` : ""})` : "";
      })
      .filter(Boolean)
      .join("\n");

    onApply({
      projectName,
      description: `Generated by Scope Engine with dynamic DB features.\n\nSelected features:\n${featureList}`,
      phases,
      contingencyPct,
      marginPct,
      salesCommissionPct,
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="rounded-xl border bg-gradient-to-br from-violet-500/10 via-card to-background p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-violet-600/10 text-violet-600 flex items-center justify-center font-bold">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                Scope of Work & Effort Engine
                <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-600 border-violet-200">
                  Database Powered
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Drag and drop features into phase buckets or click to select. Live team hours and loaded costs adjust dynamically.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsLibraryManagerOpen(true)}
              className="gap-1.5 border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/50 shadow-xs text-xs font-semibold"
            >
              <BookOpen className="size-3.5 text-violet-600" />
              <span>Feature Library & JSON</span>
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => setIsAddModalOpen(true)}
              className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white shadow-xs text-xs font-semibold"
            >
              <PlusCircle className="size-3.5" />
              <span>+ Custom Feature</span>
            </Button>
          </div>
        </div>

        {employees.length === 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 p-2.5 text-xs">
            <AlertTriangle className="size-3.5 shrink-0" />
            No team members loaded — add employees in Settings to get cost calculations.
          </div>
        )}
      </div>

      {/* ── Main Layout: Catalog (Left) + Scope Bucket / Droppable (Right) ── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_390px]">
        {/* ── LEFT COLUMN: Feature Catalog with Drag Handles ── */}
        <div className="space-y-4">
          {/* Search bar & Project Name */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Search 35+ features, tech stack, or tags…"
              />
            </div>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-[200px] rounded-lg border bg-card px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Estimate label…"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelections([])}
              className="gap-1.5 shrink-0"
              disabled={selections.length === 0}
            >
              <RefreshCw className="size-3.5" /> Clear ({selections.length})
            </Button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCategory("all")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-all border",
                activeCategory === "all"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card hover:bg-muted border-border text-muted-foreground"
              )}
            >
              <Filter className="size-3 inline mr-1" />
              All ({library.length})
            </button>
            {allCategories.map((cat) => {
              const meta = CATEGORY_META[cat] ?? { label: cat, icon: "📁", color: "text-foreground" };
              const count = library.filter((f) => f.category === cat).length;
              const selected = selections.filter((s) =>
                library.find((f) => f.id === s.featureId)?.category === cat
              ).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-all border flex items-center gap-1",
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card hover:bg-muted border-border text-muted-foreground"
                  )}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                  {selected > 0 && (
                    <span className="ml-0.5 rounded-full bg-emerald-500 text-white text-[10px] px-1.5 leading-4 font-bold">
                      {selected}
                    </span>
                  )}
                  <span className="text-muted-foreground/60 text-[10px]">·{count}</span>
                </button>
              );
            })}
          </div>

          {/* Drag instruction notice */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <div className="flex items-center gap-1.5">
              <GripVertical className="size-3 text-muted-foreground" />
              <span>Tip: <b>Drag cards</b> across to the drop zones on the right, or simply click to toggle.</span>
            </div>
            <span>{library.length} items in DB</span>
          </div>

          {/* Feature Groups & Items */}
          <div className="space-y-3">
            {Array.from(grouped.entries()).map(([cat, features]) => {
              const meta = CATEGORY_META[cat] ?? { label: cat, icon: "📁", color: "text-foreground" };
              const isExpanded = expandedCategories.has(cat);
              const selectedInCat = features.filter((f) => selectedIds.has(f.id)).length;
              return (
                <Card key={cat} className="overflow-hidden border border-border/80 shadow-xs">
                  <button
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => toggleCategory(cat)}
                  >
                    <span className="text-lg">{meta.icon}</span>
                    <span className={cn("font-display font-semibold text-sm flex-1", meta.color)}>
                      {meta.label}
                    </span>
                    {selectedInCat > 0 && (
                      <Badge className="bg-emerald-500 text-white text-[10px] h-5 px-1.5 font-bold">
                        {selectedInCat} selected
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{features.length} items</span>
                    {isExpanded ? (
                      <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t divide-y bg-muted/10">
                      {features.map((feat: FeatureDefinition & { isCustom?: boolean }) => {
                        const isSel = selectedIds.has(feat.id);
                        const sel = selections.find((s) => s.featureId === feat.id);
                        const baseEffort = feat.effort[sel?.complexity ?? "medium"] ?? {
                          designer: 0, frontend: 0, backend: 0, mobile: 0, pm: 0, qa: 0
                        };
                        const totalFeatureHours =
                          ROLE_KEYS.reduce((s, rk) => s + (baseEffort[rk] ?? 0), 0) *
                          (sel?.quantity ?? 1);
                        const isDragging = draggingFeatureId === feat.id;

                        return (
                          <div
                            key={feat.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, feat.id)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              "transition-all group",
                              isSel ? "bg-primary/5 border-l-4 border-primary" : "hover:bg-muted/30",
                              isDragging && "opacity-40 border-dashed border-2 border-primary"
                            )}
                          >
                            {/* Feature row */}
                            <div
                              className="flex items-start gap-2.5 px-3.5 py-2.5 cursor-grab active:cursor-grabbing select-none"
                              onClick={() => toggleFeature(feat.id)}
                            >
                              <div className="mt-0.5 text-muted-foreground/50 group-hover:text-primary transition-colors">
                                <GripVertical className="size-4" />
                              </div>

                              <div
                                className={cn(
                                  "mt-0.5 size-4 rounded border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer",
                                  isSel
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-border bg-card"
                                )}
                              >
                                {isSel && <Check className="size-3" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-sm text-foreground">
                                    {feat.icon} {feat.label}
                                  </span>
                                  {feat.isCustom && (
                                    <Badge variant="outline" className="text-[9px] h-4 bg-amber-500/10 text-amber-600 border-amber-300">
                                      Custom
                                    </Badge>
                                  )}
                                  {feat.tags.slice(0, 2).map((t) => (
                                    <span
                                      key={t}
                                      className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {feat.description}
                                </p>
                                {isSel && (
                                  <div className="flex items-center gap-1 mt-1 text-xs text-primary font-medium">
                                    <Clock className="size-3" />
                                    ~{totalFeatureHours}h estimated effort
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <div className="text-[10px] text-muted-foreground text-right font-mono">
                                  ~{ROLE_KEYS.reduce((s, rk) => s + (feat.effort.medium?.[rk] ?? 0), 0)}h
                                </div>
                                {feat.isCustom && (
                                  <button
                                    onClick={(e) => handleDeleteCustomFeature(feat.id, e)}
                                    title="Delete custom feature from DB"
                                    className="text-muted-foreground hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Complexity + quantity controls (only when selected) */}
                            {isSel && sel && (
                              <div
                                className="flex flex-wrap items-center gap-3 px-4 pb-2.5 ml-8 border-t border-dashed pt-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Complexity */}
                                <div className="flex items-center gap-1">
                                  <span className="text-[11px] text-muted-foreground mr-1">Scale:</span>
                                  {(["low", "medium", "high"] as Complexity[]).map((c) => {
                                    const meta = COMPLEXITY_LABELS[c];
                                    return (
                                      <button
                                        key={c}
                                        type="button"
                                        onClick={() => updateSelection(feat.id, { complexity: c })}
                                        className={cn(
                                          "rounded px-2 py-0.5 text-[10px] font-semibold border transition-all cursor-pointer",
                                          sel.complexity === c
                                            ? c === "low"
                                              ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                                              : c === "medium"
                                              ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                                              : "bg-red-500 text-white border-red-500 shadow-xs"
                                            : "bg-card border-border text-muted-foreground hover:bg-muted"
                                        )}
                                      >
                                        {meta.label}
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Quantity */}
                                <div className="flex items-center gap-1 ml-auto">
                                  <span className="text-[11px] text-muted-foreground">Qty:</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSelection(feat.id, {
                                        quantity: Math.max(1, sel.quantity - 1),
                                      })
                                    }
                                    className="rounded border bg-card hover:bg-muted p-0.5 cursor-pointer"
                                  >
                                    <Minus className="size-3" />
                                  </button>
                                  <span className="w-5 text-center text-xs font-mono font-bold">
                                    {sel.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateSelection(feat.id, { quantity: sel.quantity + 1 })
                                    }
                                    className="rounded border bg-card hover:bg-muted p-0.5 cursor-pointer"
                                  >
                                    <Plus className="size-3" />
                                  </button>
                                </div>

                                {/* Per-role mini hour tags */}
                                <div className="w-full grid grid-cols-6 gap-1 mt-1">
                                  {ROLE_KEYS.map((rk) => {
                                    const h = (feat.effort[sel.complexity]?.[rk] ?? 0) * sel.quantity;
                                    if (h === 0) return null;
                                    const meta = ROLE_LABELS[rk];
                                    return (
                                      <div key={rk} className="text-center">
                                        <div
                                          className={cn(
                                            "rounded text-[9px] text-white font-bold px-1 py-0.5",
                                            meta.color
                                          )}
                                        >
                                          {h}h
                                        </div>
                                        <div className="text-[8px] text-muted-foreground mt-0.5 truncate">
                                          {meta.short}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT COLUMN: Interactive Droppable Scope Bucket & Financial Summary ── */}
        <div className="space-y-4 lg:sticky lg:top-4">
          {/* DRAG-AND-DROP TARGET AREA */}
          <div
            onDragOver={(e) => handleDragOver(e, "main-scope")}
            onDragLeave={(e) => handleDragLeave(e, "main-scope")}
            onDrop={(e) => handleDrop(e, "auto")}
            className={cn(
              "rounded-xl border-2 border-dashed p-4 transition-all duration-200 text-center relative overflow-hidden",
              dragOverTarget === "main-scope"
                ? "border-violet-500 bg-violet-500/15 shadow-lg scale-[1.01]"
                : draggingFeatureId
                ? "border-violet-400/80 bg-violet-500/5 animate-pulse"
                : "border-border/80 bg-muted/20 hover:border-violet-400/50"
            )}
          >
            <div className="flex flex-col items-center gap-1.5 py-1">
              <div
                className={cn(
                  "size-10 rounded-full flex items-center justify-center transition-all",
                  dragOverTarget === "main-scope"
                    ? "bg-violet-600 text-white scale-110"
                    : "bg-violet-500/10 text-violet-600"
                )}
              >
                <Layers className="size-5" />
              </div>
              <h3 className="font-display font-semibold text-sm">
                {dragOverTarget === "main-scope"
                  ? "🎯 Release to Drop Feature Here!"
                  : "Drag & Drop Scope Target"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-[280px]">
                {draggingFeatureId
                  ? "Release your mouse over this zone to add the feature into scope."
                  : "Drag feature cards from the left and drop them right here to build your scope."}
              </p>
            </div>

            {/* Quick Phase Drop Buckets */}
            <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-dashed">
              {(
                [
                  { id: "design", label: "🎨 Design", icon: "🎨" },
                  { id: "dev",    label: "💻 Dev",    icon: "💻" },
                  { id: "qa",     label: "🧪 QA",     icon: "🧪" },
                ] as const
              ).map((phase) => (
                <div
                  key={phase.id}
                  onDragOver={(e) => {
                    e.stopPropagation();
                    handleDragOver(e, phase.id);
                  }}
                  onDragLeave={(e) => {
                    e.stopPropagation();
                    handleDragLeave(e, phase.id);
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    handleDrop(e, phase.id);
                  }}
                  className={cn(
                    "rounded-lg border text-center p-2 transition-all cursor-pointer text-xs font-semibold",
                    dragOverTarget === phase.id
                      ? "border-violet-600 bg-violet-600 text-white shadow-md scale-105"
                      : "border-border bg-card/60 hover:bg-muted/50 text-foreground"
                  )}
                >
                  <div className="text-[11px]">{phase.label}</div>
                  <div className="text-[9px] text-muted-foreground/80 mt-0.5">
                    {dragOverTarget === phase.id ? "Release!" : "Drop here"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Effort Summary by Role */}
          <Card className="border-primary/20 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  Effort by Role
                </span>
                <span className="font-mono text-xs font-bold text-primary">
                  {Math.round(effort.totalHours)} hrs total
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                {selections.length === 0
                  ? "Select or drop features to generate estimates."
                  : `${selections.length} feature${selections.length !== 1 ? "s" : ""} in scope · ${Math.round(effort.totalHours / 8)} business days`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {effort.byRole.map(({ role, hours, cost }) => {
                if (hours === 0) return null;
                const meta = ROLE_LABELS[role];
                const emp = matchEmployeeForRole(role, employees);
                const pct =
                  effort.totalHours > 0
                    ? Math.round((hours / effort.totalHours) * 100)
                    : 0;
                return (
                  <div key={role} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-full shrink-0", meta.color)} />
                        <span className="font-medium">{meta.label}</span>
                        {emp && (
                          <span className="text-muted-foreground text-[10px]">
                            ({emp.name})
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-semibold">{Math.round(hours)}h</span>
                        {cost > 0 && (
                          <span className="text-muted-foreground ml-1 font-mono">
                            · {formatMoney(cost, currency)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", meta.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {selections.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-5 text-center text-muted-foreground text-xs">
                  <Sparkles className="size-7 opacity-30" />
                  <p>No features selected. Drag & drop or tick checkboxes on the left.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Financial summary */}
          {effort.totalHours > 0 && (
            <Card className="bg-gradient-to-br from-primary/5 via-card to-background border-primary/20 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Cost & Pricing Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(
                  [
                    { label: "Labour Cost",        value: effort.totalCost,         muted: false },
                    { label: `Contingency (${contingencyPct}%)`, value: contingencyAmt, muted: true  },
                    { label: "Total Delivery Cost", value: totalWithContingency,     muted: false },
                    { label: `Margin (${marginPct}%)`,           value: price - totalWithContingency, muted: true  },
                    { label: "Quote to Client",    value: price,                    muted: false },
                    { label: `Commission (Ayesha ${salesCommissionPct}%)`, value: commission, muted: true },
                    { label: "Net Company Profit", value: netProfit,                muted: false },
                  ] as const
                ).map(({ label, value, muted }) => (
                  <div
                    key={label}
                    className={cn(
                      "flex items-center justify-between text-xs",
                      muted && "opacity-70"
                    )}
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        value < 0 ? "text-red-500" : !muted ? "text-foreground font-bold" : "text-muted-foreground"
                      )}
                    >
                      {formatMoney(value, currency)}
                    </span>
                  </div>
                ))}

                {/* Rate breakdown card */}
                <div className="pt-2 border-t mt-1 grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    { label: "/hr", val: effort.totalHours > 0 ? price / effort.totalHours : 0 },
                    { label: "/day (8h)", val: effort.totalHours > 0 ? (price / effort.totalHours) * 8 : 0 },
                    { label: "/week (40h)", val: effort.totalHours > 0 ? (price / effort.totalHours) * 40 : 0 },
                    { label: "/month (160h)", val: effort.totalHours > 0 ? (price / effort.totalHours) * 160 : 0 },
                  ].map(({ label, val }) => (
                    <div key={label} className="rounded-lg bg-muted/40 p-2 text-center">
                      <p className="text-muted-foreground text-[10px]">{label}</p>
                      <p className="font-bold font-mono text-xs mt-0.5">
                        {formatMoney(val, currency)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <div className="rounded-lg bg-primary text-primary-foreground p-3 text-center mb-3 shadow-sm">
                    <p className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">Total Client Quote</p>
                    <p className="text-2xl font-bold font-display mt-0.5">
                      {formatMoney(price, currency)}
                    </p>
                    <p className="text-xs opacity-75 mt-0.5">
                      ~{Math.round(effort.totalHours)}h · {Math.round(effort.totalHours / 8)} days · ~{(effort.totalHours / 40).toFixed(1)} wks
                    </p>
                  </div>

                  <Button
                    className="w-full gap-2 font-semibold shadow-sm"
                    size="lg"
                    onClick={handleApply}
                    disabled={selections.length === 0}
                  >
                    Apply to Detailed Estimate
                    <ArrowRight className="size-4" />
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                    Transfers phases to Detailed Breakdown for line-item fine tuning
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active selected features list */}
          {selections.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Selected in Scope ({selections.length})</span>
                  <span className="font-mono text-foreground font-bold">{Math.round(effort.totalHours)}h</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 max-h-64 overflow-y-auto">
                {selections.map((sel) => {
                  const feat = library.find((f) => f.id === sel.featureId);
                  if (!feat) return null;
                  const hours =
                    ROLE_KEYS.reduce((s, rk) => s + (feat.effort[sel.complexity]?.[rk] ?? 0), 0) *
                    sel.quantity;
                  return (
                    <div
                      key={sel.featureId}
                      className="flex items-center justify-between text-xs gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <span className="truncate font-medium">
                        {feat.icon} {feat.label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] h-4 px-1",
                            sel.complexity === "low"
                              ? "text-emerald-600 border-emerald-300"
                              : sel.complexity === "medium"
                              ? "text-amber-600 border-amber-300"
                              : "text-red-600 border-red-300"
                          )}
                        >
                          {COMPLEXITY_LABELS[sel.complexity].label}
                        </Badge>
                        {sel.quantity > 1 && (
                          <span className="text-muted-foreground font-mono">×{sel.quantity}</span>
                        )}
                        <span className="font-mono font-bold text-primary">{Math.round(hours)}h</span>
                        <button
                          type="button"
                          onClick={() => toggleFeature(sel.featureId)}
                          className="text-muted-foreground hover:text-red-500 transition-colors cursor-pointer ml-0.5"
                          title="Remove feature"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── CREATE CUSTOM FEATURE DIALOG (Database Stored) ── */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <PlusCircle className="size-5 text-violet-600" />
              Add Custom Feature to Library
            </DialogTitle>
            <DialogDescription>
              Create a custom feature with estimated role effort. It will be saved to your MySQL database and available across your team.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCustomFeature} className="space-y-4">
            <div className="grid grid-cols-[60px_1fr] gap-2">
              <div>
                <Label htmlFor="feat-icon" className="text-xs">Icon</Label>
                <Input
                  id="feat-icon"
                  value={newFeature.icon}
                  onChange={(e) => setNewFeature({ ...newFeature, icon: e.target.value })}
                  placeholder="⚡"
                  className="text-center text-lg"
                />
              </div>
              <div>
                <Label htmlFor="feat-name" className="text-xs">Feature Name</Label>
                <Input
                  id="feat-name"
                  value={newFeature.label}
                  onChange={(e) => setNewFeature({ ...newFeature, label: e.target.value })}
                  placeholder="e.g. AI Chatbot Integration"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="feat-cat" className="text-xs">Category</Label>
              <select
                id="feat-cat"
                value={newFeature.category}
                onChange={(e) => setNewFeature({ ...newFeature, category: e.target.value as FeatureCategory })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_META[cat]?.icon} {CATEGORY_META[cat]?.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="feat-desc" className="text-xs">Description</Label>
              <Textarea
                id="feat-desc"
                value={newFeature.description}
                onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                placeholder="Key deliverables, scope details, and tech requirements..."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="feat-tags" className="text-xs">Tags (comma-separated)</Label>
              <Input
                id="feat-tags"
                value={newFeature.tags}
                onChange={(e) => setNewFeature({ ...newFeature, tags: e.target.value })}
                placeholder="ai, chatbot, openai"
              />
            </div>

            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Standard Effort per Role (Hours for Medium tier)</span>
                <span className="text-[10px] text-muted-foreground">Auto-scales 0.5x Low / 2x High</span>
              </Label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-muted-foreground">🎨 UI/UX Design</span>
                  <Input
                    type="number"
                    min="0"
                    value={newFeature.designer}
                    onChange={(e) => setNewFeature({ ...newFeature, designer: Number(e.target.value) })}
                    className="h-8"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">💻 Frontend Dev</span>
                  <Input
                    type="number"
                    min="0"
                    value={newFeature.frontend}
                    onChange={(e) => setNewFeature({ ...newFeature, frontend: Number(e.target.value) })}
                    className="h-8"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">⚙️ Backend Dev</span>
                  <Input
                    type="number"
                    min="0"
                    value={newFeature.backend}
                    onChange={(e) => setNewFeature({ ...newFeature, backend: Number(e.target.value) })}
                    className="h-8"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">📱 Mobile Dev</span>
                  <Input
                    type="number"
                    min="0"
                    value={newFeature.mobile}
                    onChange={(e) => setNewFeature({ ...newFeature, mobile: Number(e.target.value) })}
                    className="h-8"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">📋 PM / Lead</span>
                  <Input
                    type="number"
                    min="0"
                    value={newFeature.pm}
                    onChange={(e) => setNewFeature({ ...newFeature, pm: Number(e.target.value) })}
                    className="h-8"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">🧪 QA / Testing</span>
                  <Input
                    type="number"
                    min="0"
                    value={newFeature.qa}
                    onChange={(e) => setNewFeature({ ...newFeature, qa: Number(e.target.value) })}
                    className="h-8"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                disabled={savingFeature}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingFeature} className="bg-violet-600 hover:bg-violet-700 text-white">
                {savingFeature ? "Saving to DB..." : "Save Feature to DB"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Feature Library & JSON Hub Modal */}
      <FeatureLibraryManager
        open={isLibraryManagerOpen}
        onOpenChange={setIsLibraryManagerOpen}
        companyId={companyId}
      />
    </div>
  );
});
