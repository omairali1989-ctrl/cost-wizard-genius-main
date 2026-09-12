  const { presets } = usePresetLibrary(companyId);
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { PageHeader } from "@/components/AppShell";
import { logActivity, useTeamRates, useOverheads, type WorkspaceData } from "@/lib/workspace";
import {
  calculate,
  emptyInputs,
  validateInputs,
  formatMoney,
  type Allocation,
  type CalculationInputs,
  type LineItem,
  type Phase,
  type TechItem,
} from "@/lib/pricing";
import {
  Sparkles,
  SlidersHorizontal,
  Crosshair,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Check,
  Save,
  Printer,
  Layers,
  Users,
  ShieldCheck,
  BarChart3,
  Calendar,
  Clock,
  Rocket,
  Zap,
  HelpCircle,
  Eye,
  Wand2,
  History,
  BookOpen,
  GitBranch,
} from "lucide-react";
import { ScopeEngine } from "@/components/scope-engine/ScopeEngine";
import { FeatureLibraryManager } from "@/components/scope-engine/FeatureLibraryManager";
import {
  VersionHistoryModal,
  type CalculationRecord,
} from "@/components/calculator/VersionHistoryModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CalculatorBasics } from "@/components/calculator/CalculatorBasics";
import { CalculatorPhases } from "@/components/calculator/CalculatorPhases";
import { CalculatorSupport } from "@/components/calculator/CalculatorSupport";
import { CalculatorExtras } from "@/components/calculator/CalculatorExtras";
import { CalculatorPricing } from "@/components/calculator/CalculatorPricing";
import { CalculatorLiveResult } from "@/components/calculator/CalculatorLiveResult";
import { DetailedBreakdownView } from "@/components/calculator/DetailedBreakdownView";
import { usePresetLibrary } from "@/components/calculator/qce/presetLibrary";
import {
  PRESET_CATEGORIES,
  type PresetCategory,
  type PresetConfig,
  type ProjectPresetId,
  type LinkedStackItem,
} from "@/components/calculator/qce/types";
import {
  BlueprintStackLinker,
  matchEmployeeForTech,
} from "@/components/calculator/BlueprintStackLinker";
import { cn } from "@/lib/utils";

// ─── Wizard Step Definitions ──────────────────────────────────────────────────
export type WizardStepId = 1 | 2 | 3 | 4 | 5;

interface WizardStepMeta {
  id: WizardStepId;
  title: string;
  shortTitle: string;
  subtitle: string;
  icon: string;
}

const WIZARD_STEPS: WizardStepMeta[] = [
  {
    id: 1,
    title: "1. Project & Blueprint",
    shortTitle: "Blueprint",
    subtitle: "Define basics & select software scope template",
    icon: "📋",
  },
  {
    id: 2,
    title: "2. Scope & Features",
    shortTitle: "Features",
    subtitle: "Drag & drop features from DB library into phases",
    icon: "🎯",
  },
  {
    id: 3,
    title: "3. Team & Allocations",
    shortTitle: "Team Squad",
    subtitle: "Auto-adjust squad durations & phase line items",
    icon: "👥",
  },
  {
    id: 4,
    title: "4. Retainer & Risk",
    shortTitle: "Risk & Extras",
    subtitle: "Support retainer, tools, margin & overheads",
    icon: "🛡️",
  },
  {
    id: 5,
    title: "5. Executive Proposal",
    shortTitle: "Executive Quote",
    subtitle: "Multi-unit rate cards, waterfall & save/export",
    icon: "📊",
  },
];

export const Route = createFileRoute("/_authenticated/calculator")({
  validateSearch: (search: Record<string, unknown>): { project?: string } => {
    const p = search["project"];
    return typeof p === "string" ? { project: p } : {};
  },
  head: () => ({
    meta: [
      { title: "Cost Wizard Genius — Alisons Technology" },
      {
        name: "description",
        content: "Guided multi-step cost and pricing wizard for software development projects.",
      },
      { property: "og:title", content: "Cost Wizard Genius" },
      { property: "og:description", content: "Guided multi-step cost and pricing wizard." },
    ],
  }),
  component: () => <WorkspaceGate>{(ws) => <Calculator workspace={ws} />}</WorkspaceGate>,
});

function Calculator({ workspace }: { workspace: WorkspaceData }) {
  const companyId = workspace.company!.id;
  const currency = workspace.company!.currency;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { project: projectId } = Route.useSearch();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(projectId ?? null);
  const { data: employees = [] } = useTeamRates(companyId);
  const { data: overheads = [] } = useOverheads(companyId);
  const policy = workspace.policy!;
  const { presets } = usePresetLibrary();

  // ─── State ──────────────────────────────────────────────────────────────────
  const [inputs, setInputs] = useState<CalculationInputs>(() => emptyInputs(policy, currency));
  const [saving, setSaving] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);

  // Modals state
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isLibraryManagerOpen, setIsLibraryManagerOpen] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStepId>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"wizard" | "all-in-one">("wizard");
  const [selectedPresetId, setSelectedPresetId] = useState<ProjectPresetId | null>("mvp");
  const [selectedPresetCategory, setSelectedPresetCategory] = useState<PresetCategory>("All");
  const [presetSearch, setPresetSearch] = useState("");

  // Stack & employee linking state for Step 1
  const [activeStack, setActiveStack] = useState<LinkedStackItem[]>([]);
  const [stackApplied, setStackApplied] = useState(false);

  // Query all saved versions for the active project
  const { data: projectVersions = [] } = useQuery({
    queryKey: ["project-versions", activeProjectId],
    enabled: !!activeProjectId,
    queryFn: async (): Promise<CalculationRecord[]> => {
      if (!activeProjectId) return [];
      const { data, error } = await supabase
        .from("calculations")
        .select("*")
        .eq("project_id", activeProjectId)
        .order("version", { ascending: false });
      if (error) {
        console.error("Failed to fetch versions:", error);
        return [];
      }
      return (data ?? []) as unknown as CalculationRecord[];
    },
  });

  // When continuing an existing project, start from its most recent saved version.
  useEffect(() => {
    if (!projectId) return;
    setActiveProjectId(projectId);
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("calculations")
        .select("inputs, version")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.inputs) {
        setInputs(data.inputs as unknown as CalculationInputs);
        setLoadedVersion(Number(data.version));
        // If loading an existing project, open review step
        setCurrentStep(5);
        setCompletedSteps(new Set([1, 2, 3, 4]));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const rateFor = useCallback(
    (id: string) => employees.find((e) => e.id === id)?.hourly_cost ?? 0,
    [employees],
  );

  const results = useMemo(() => calculate(inputs), [inputs]);
  const issues = useMemo(() => validateInputs(inputs, results), [inputs, results]);
  const blocking = useMemo(() => issues.some((i) => i.level === "error"), [issues]);

  const patch = useCallback(
    (p: Partial<CalculationInputs>) => setInputs((prev) => ({ ...prev, ...p })),
    [],
  );

  // ─── Step Navigation ────────────────────────────────────────────────────────
  const goToStep = useCallback((step: WizardStepId) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSelectVersion = useCallback((record: CalculationRecord) => {
    if (record.inputs) {
      setInputs(record.inputs);
      setLoadedVersion(record.version);
      goToStep(5);
    }
  }, [goToStep]);

  const nextStep = useCallback(() => {
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    if (currentStep < 5) {
      goToStep((currentStep + 1) as WizardStepId);
    }
  }, [currentStep, goToStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      goToStep((currentStep - 1) as WizardStepId);
    }
  }, [currentStep, goToStep]);

  // ─── Preset Blueprint Application ──────────────────────────────────────────
  const applyPresetBlueprint = useCallback(
    (preset: PresetConfig) => {
      setSelectedPresetId(preset.id);
      setStackApplied(false);

      // ── Initialize tech stack from preset, auto-match employees ──
      if (preset.techStack && preset.techStack.length > 0) {
        const linked: LinkedStackItem[] = preset.techStack.map((item) => {
          const emp = matchEmployeeForTech(
            item.tech,
            item.category,
            employees,
            item.suggestedEmployeeSubstr
          );
          return {
            id: item.id,
            tech: item.tech,
            category: item.category,
            roleLabel: item.roleLabel,
            allocationPct: item.allocationPct,
            employeeId: emp?.id ?? (employees[0]?.id ?? ""),
          };
        });
        setActiveStack(linked);
      } else {
        setActiveStack([]);
      }

      const durationHours =
        preset.defaultDurationUnit === "days"
          ? preset.defaultDurationValue * 8
          : preset.defaultDurationUnit === "weeks"
          ? preset.defaultDurationValue * 40
          : preset.defaultDurationUnit === "months"
          ? preset.defaultDurationValue * 160
          : preset.defaultDurationValue;

      const designAllocations: Allocation[] = [];
      const devAllocations: Allocation[] = [];
      const qaAllocations: Allocation[] = [];

      for (const s of preset.suggestedRoles) {
        const emp = employees.find((e) =>
          e.name.toLowerCase().includes(s.nameSubstr.toLowerCase())
        );
        if (!emp) continue;
        const hours = Math.round(durationHours * (s.allocationPct / 100));
        const alloc: Allocation = {
          id: `alloc-${emp.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          employeeId: emp.id,
          label: s.label || emp.job_title || emp.name,
          hours,
          hourlyCost: emp.hourly_cost,
        };

        const title = (emp.job_title || "").toLowerCase();
        const dept = (emp.department || "").toLowerCase();
        if (title.includes("design") || dept.includes("design")) {
          designAllocations.push(alloc);
        } else if (
          title.includes("pm") ||
          title.includes("manager") ||
          title.includes("qa") ||
          title.includes("tester")
        ) {
          qaAllocations.push(alloc);
        } else {
          devAllocations.push(alloc);
        }
      }

      const newPhases: Phase[] = [];
      if (designAllocations.length > 0) {
        newPhases.push({
          id: "phase-init-design",
          name: "UI/UX Design & Prototyping",
          allocations: designAllocations,
        });
      }
      if (devAllocations.length > 0) {
        newPhases.push({
          id: "phase-init-dev",
          name: "Core Engineering & Development",
          allocations: devAllocations,
        });
      }
      if (qaAllocations.length > 0) {
        newPhases.push({
          id: "phase-init-qa",
          name: "QA, Testing & Launch",
          allocations: qaAllocations,
        });
      }

      setInputs((prev) => ({
        ...prev,
        projectName: prev.projectName || `${preset.title} Estimate`,
        description:
          prev.description ||
          `${preset.description} (Target: ${preset.defaultDurationValue} ${preset.defaultDurationUnit})`,
        phases: newPhases.length > 0 ? newPhases : prev.phases,
      }));
      toast.success(`✨ Loaded "${preset.title}" blueprint with team allocations!`);
    },
    [employees]
  );

  // ─── Apply Stack to Squad (generates phases from activeStack) ──────────────
  const applyStackToSquad = useCallback(() => {
    if (activeStack.length === 0) {
      toast.error("No stack technologies configured. Add some tech layers first.");
      return;
    }

    const selectedPreset = presets.find((p) => p.id === selectedPresetId);
    const durationHours = selectedPreset
      ? selectedPreset.defaultDurationUnit === "days"
        ? selectedPreset.defaultDurationValue * 8
        : selectedPreset.defaultDurationUnit === "weeks"
        ? selectedPreset.defaultDurationValue * 40
        : selectedPreset.defaultDurationUnit === "months"
        ? selectedPreset.defaultDurationValue * 160
        : selectedPreset.defaultDurationValue
      : 160; // default 1 month

    const designAllocs: Allocation[] = [];
    const devAllocs: Allocation[] = [];
    const mobileAllocs: Allocation[] = [];
    const qaAllocs: Allocation[] = [];
    const mgmtAllocs: Allocation[] = [];

    const seenDesign = new Set<string>();
    const seenDev = new Set<string>();
    const seenMobile = new Set<string>();
    const seenQa = new Set<string>();
    const seenMgmt = new Set<string>();

    for (const item of activeStack) {
      const emp = employees.find((e) => e.id === item.employeeId);
      if (!emp) continue;

      const hours = Math.round(durationHours * (item.allocationPct / 100));
      const allocId = `alloc-stack-${emp.id}-${item.id}-${Math.random().toString(36).slice(2, 6)}`;
      const alloc: Allocation = {
        id: allocId,
        employeeId: emp.id,
        label: item.roleLabel || item.tech,
        hours,
        hourlyCost: emp.hourly_cost,
      };

      // Route to phase by stack category
      if (item.category === "design") {
        if (!seenDesign.has(emp.id)) {
          designAllocs.push(alloc);
          seenDesign.add(emp.id);
        }
      } else if (item.category === "mobile") {
        if (!seenMobile.has(emp.id)) {
          mobileAllocs.push(alloc);
          seenMobile.add(emp.id);
        }
      } else if (item.category === "qa") {
        if (!seenQa.has(emp.id)) {
          qaAllocs.push(alloc);
          seenQa.add(emp.id);
        }
      } else if (item.category === "management") {
        if (!seenMgmt.has(emp.id)) {
          mgmtAllocs.push(alloc);
          seenMgmt.add(emp.id);
        }
      } else {
        // frontend, backend, database, devops, other → dev phase
        if (!seenDev.has(emp.id)) {
          devAllocs.push(alloc);
          seenDev.add(emp.id);
        }
      }
    }


    const phases: Phase[] = [];
    if (designAllocs.length > 0) {
      phases.push({ id: "phase-stack-design", name: "UI/UX Design & Prototyping", allocations: designAllocs });
    }
    if (mobileAllocs.length > 0) {
      phases.push({ id: "phase-stack-mobile", name: "Mobile App Development", allocations: mobileAllocs });
    }
    if (devAllocs.length > 0) {
      phases.push({ id: "phase-stack-dev", name: "Engineering & Backend Development", allocations: devAllocs });
    }
    if (qaAllocs.length > 0) {
      phases.push({ id: "phase-stack-qa", name: "QA, Testing & DevOps", allocations: qaAllocs });
    }
    if (mgmtAllocs.length > 0) {
      phases.push({ id: "phase-stack-mgmt", name: "Project Management & Delivery", allocations: mgmtAllocs });
    }

    setInputs((prev) => ({
      ...prev,
      phases: phases.length > 0 ? phases : prev.phases,
    }));
    setStackApplied(true);
    toast.success(`🚀 Stack applied! ${phases.length} phases with ${activeStack.length} tech layers synced to Step 3.`);
  }, [activeStack, employees, selectedPresetId]);

  // ─── Scope Application ─────────────────────────────────────────────────────

  const handleApplyScope = useCallback((scopeInputs: Partial<CalculationInputs>) => {
    setInputs((prev) => ({
      ...prev,
      ...scopeInputs,
      projectName:
        prev.projectName && prev.projectName.trim() !== "New Project" && prev.projectName.trim() !== ""
          ? prev.projectName
          : (scopeInputs.projectName || prev.projectName),
    }));
    setCompletedSteps((prev) => new Set([...prev, 2]));
    goToStep(3);
    toast.success("✅ Scope applied! Review and fine-tune team allocations in Step 3.");
  }, [goToStep]);

  // ─── Phase Handlers ────────────────────────────────────────────────────────
  const handleAddPhase = useCallback(() => {
    setInputs((prev) => ({
      ...prev,
      phases: [
        ...prev.phases,
        { id: `phase-${Date.now()}`, name: "New Phase", allocations: [] },
      ],
    }));
  }, []);

  const handleAddPhaseTemplate = useCallback((phase: Phase) => {
    setInputs((prev) => ({
      ...prev,
      phases: [...prev.phases, phase],
    }));
    toast.success(`Added phase "${phase.name}"`);
  }, []);

  const handleRemovePhase = useCallback((phaseId: string) => {
    setInputs((prev) => ({
      ...prev,
      phases: prev.phases.filter((p) => p.id !== phaseId),
    }));
  }, []);

  const handleUpdatePhaseName = useCallback((phaseId: string, name: string) => {
    setInputs((prev) => ({
      ...prev,
      phases: prev.phases.map((p) => (p.id === phaseId ? { ...p, name } : p)),
    }));
  }, []);

  const handleAddAllocation = useCallback((phaseId: string) => {
    setInputs((prev) => ({
      ...prev,
      phases: prev.phases.map((ph) =>
        ph.id === phaseId
          ? {
              ...ph,
              allocations: [
                ...ph.allocations,
                {
                  id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  employeeId: null,
                  label: "",
                  hours: 0,
                  hourlyCost: 0,
                },
              ],
            }
          : ph,
      ),
    }));
  }, []);

  const handleUpdateAllocation = useCallback(
    (phaseId: string, allocId: string, p: Partial<Allocation>) => {
      setInputs((prev) => ({
        ...prev,
        phases: prev.phases.map((ph) =>
          ph.id === phaseId
            ? {
                ...ph,
                allocations: ph.allocations.map((a) => (a.id === allocId ? { ...a, ...p } : a)),
              }
            : ph,
        ),
      }));
    },
    [],
  );

  const handleRemoveAllocation = useCallback((phaseId: string, allocId: string) => {
    setInputs((prev) => ({
      ...prev,
      phases: prev.phases.map((ph) =>
        ph.id === phaseId
          ? { ...ph, allocations: ph.allocations.filter((a) => a.id !== allocId) }
          : ph,
      ),
    }));
  }, []);

  const handleSupportChange = useCallback(
    (supportPatch: Partial<CalculationInputs["support"]>) => {
      setInputs((prev) => ({
        ...prev,
        support: { ...prev.support, ...supportPatch },
      }));
    },
    [],
  );

  const handleAddAdditionalWork = useCallback(() => {
    setInputs((prev) => ({
      ...prev,
      additionalWork: [
        ...prev.additionalWork,
        { id: `work-${Date.now()}`, label: "", amount: 0 },
      ],
    }));
  }, []);

  const handleUpdateAdditionalWork = useCallback((id: string, itemPatch: Partial<LineItem>) => {
    setInputs((prev) => ({
      ...prev,
      additionalWork: prev.additionalWork.map((i) =>
        i.id === id ? { ...i, ...itemPatch } : i,
      ),
    }));
  }, []);

  const handleRemoveAdditionalWork = useCallback((id: string) => {
    setInputs((prev) => ({
      ...prev,
      additionalWork: prev.additionalWork.filter((i) => i.id !== id),
    }));
  }, []);

  const handleAddTechnology = useCallback(() => {
    setInputs((prev) => ({
      ...prev,
      technology: [
        ...prev.technology,
        {
          id: `tech-${Date.now()}`,
          label: "",
          monthlyCost: 0,
          months: 0,
          oneOffCost: 0,
        },
      ],
    }));
  }, []);

  const handleUpdateTechnology = useCallback((id: string, techPatch: Partial<TechItem>) => {
    setInputs((prev) => ({
      ...prev,
      technology: prev.technology.map((x) => (x.id === id ? { ...x, ...techPatch } : x)),
    }));
  }, []);

  const handleRemoveTechnology = useCallback((id: string) => {
    setInputs((prev) => ({
      ...prev,
      technology: prev.technology.filter((x) => x.id !== id),
    }));
  }, []);

  // ─── Save Calculation ───────────────────────────────────────────────────────
  const save = useCallback(
    async (customLabel?: string) => {
      if (!workspace.canEdit) {
        toast.error("You have view-only access.");
        return;
      }
      if (blocking) {
        toast.error("Fix the highlighted items first.");
        return;
      }
      setSaving(true);

      let targetId = activeProjectId ?? null;
      if (targetId) {
        await supabase
          .from("projects")
          .update({
            name: inputs.projectName || "Untitled Project",
            client_name: inputs.clientName || null,
            description: inputs.description || null,
          })
          .eq("id", targetId);
      } else {
        const { data: project, error: pErr } = await supabase
          .from("projects")
          .insert({
            company_id: companyId,
            name: inputs.projectName || "New Estimate Project",
            client_name: inputs.clientName || null,
            description: inputs.description || null,
            created_by: workspace.userId,
          })
          .select("id")
          .single();
        if (pErr || !project) {
          setSaving(false);
          toast.error(pErr?.message ?? "Could not save");
          return;
        }
        targetId = project.id;
        setActiveProjectId(targetId);
      }

      const { data: last } = await supabase
        .from("calculations")
        .select("version")
        .eq("project_id", targetId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextVersion = Number(last?.version ?? 0) + 1;
      const label =
        typeof customLabel === "string" && customLabel.trim()
          ? customLabel.trim()
          : `Version ${nextVersion}`;

      const { error: cErr } = await supabase.from("calculations").insert({
        company_id: companyId,
        project_id: targetId,
        label,
        version: nextVersion,
        inputs: inputs as never,
        results: results as never,
        created_by: workspace.userId,
      });
      setSaving(false);
      if (cErr) {
        toast.error(cErr.message);
        return;
      }

      setLoadedVersion(nextVersion);
      await queryClient.invalidateQueries({ queryKey: ["project-versions", targetId] });
      await logActivity(
        companyId,
        "saved_version",
        "calculation",
        targetId,
        { name: inputs.projectName, version: nextVersion, label },
      );
      toast.success(`✨ Version ${nextVersion} saved successfully!`, {
        description: label,
        action: {
          label: "View Project",
          onClick: () => navigate({ to: "/projects/$id", params: { id: targetId! } }),
        },
      });
    },
    [workspace.canEdit, workspace.userId, blocking, activeProjectId, inputs, results, companyId, queryClient, navigate]
  );

  // Filtered presets for Step 1
  const filteredPresets = useMemo(() => {
    return presets.filter((p) => {
      const matchCat =
        selectedPresetCategory === "All" || p.category === selectedPresetCategory;
      const matchSearch =
        !presetSearch.trim() ||
        p.title.toLowerCase().includes(presetSearch.toLowerCase()) ||
        p.description.toLowerCase().includes(presetSearch.toLowerCase()) ||
        p.badge.toLowerCase().includes(presetSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [presets, selectedPresetCategory, presetSearch]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-28">
      {/* ── Page Header ── */}
      <PageHeader
        title="Cost Wizard Genius"
        description="Guided 5-step software cost & pricing platform for Alisons Technology. Live MySQL rates, drag-and-drop feature scoping, and executive proposal generation."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Version Badge & History Button */}
            {activeProjectId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsVersionHistoryOpen(true)}
                className="h-8 gap-1.5 text-xs font-semibold border-primary/40 bg-primary/5 hover:bg-primary/10 text-foreground"
              >
                <History className="size-3.5 text-primary" />
                <span>v{loadedVersion || 1}</span>
                <span className="text-muted-foreground text-[10px]">
                  ({projectVersions.length} {projectVersions.length === 1 ? "version" : "versions"})
                </span>
              </Button>
            )}

            {/* Feature Library & JSON Hub */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLibraryManagerOpen(true)}
              className="h-8 gap-1.5 text-xs font-semibold border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/50"
            >
              <BookOpen className="size-3.5 text-violet-600" />
              <span className="hidden sm:inline">Feature Library & JSON</span>
              <span className="sm:hidden">Library</span>
            </Button>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 rounded-lg border bg-muted/60 p-1">
              <Button
                type="button"
                variant={viewMode === "wizard" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("wizard")}
                className="h-7 gap-1.5 text-xs font-semibold"
              >
                <Wand2 className="size-3.5" />
                <span>Wizard</span>
              </Button>
              <Button
                type="button"
                variant={viewMode === "all-in-one" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("all-in-one")}
                className="h-7 gap-1.5 text-xs font-semibold"
              >
                <Eye className="size-3.5" />
                <span>Full Page</span>
              </Button>
            </div>
          </div>
        }
      />

      {/* ── Guided Wizard Navigation Bar (Active in Wizard Mode) ── */}
      {viewMode === "wizard" && (
        <div className="rounded-xl border bg-card p-3 shadow-xs">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {WIZARD_STEPS.map((s) => {
              const isActive = currentStep === s.id;
              const isDone = completedSteps.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => goToStep(s.id)}
                  className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer relative overflow-hidden",
                    isActive
                      ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                      : isDone
                      ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                      : "border-border/70 hover:bg-muted/50"
                  )}
                >
                  <div
                    className={cn(
                      "size-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isDone
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isDone ? <Check className="size-3.5" /> : s.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold truncate">{s.shortTitle}</span>
                      {isDone && <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{s.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Stepper progress bar */}
          <div className="h-1 bg-muted rounded-full overflow-hidden mt-2.5">
            <div
              className="h-full bg-gradient-to-r from-violet-500 via-primary to-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── WIZARD STEP CONTENTS ── */}
      {viewMode === "wizard" ? (
        <div className="space-y-6">
          {/* ════ STEP 1: Project & Blueprint ════ */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="rounded-xl border bg-gradient-to-br from-violet-500/10 via-card to-background p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">📋</span>
                  <h2 className="font-display font-bold text-lg">Step 1: Project Basics & Scope Blueprint</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Give your project a name and choose an industry scope blueprint (MVP, Mobile, SaaS, E-Commerce) to auto-configure initial team allocations.
                </p>
              </div>

              {/* Project Basics Inputs */}
              <CalculatorBasics
                projectName={inputs.projectName}
                clientName={inputs.clientName}
                description={inputs.description}
                onChange={patch}
              />

              {/* Scope Blueprint Selector */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="font-display text-base flex items-center gap-2">
                        <Rocket className="size-4 text-primary" />
                        Select a Software Scope Blueprint
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Clicking a blueprint automatically loads recommended team roles and timeline estimates.
                      </CardDescription>
                    </div>

                    <div className="w-full sm:w-60">
                      <Input
                        value={presetSearch}
                        onChange={(e) => setPresetSearch(e.target.value)}
                        placeholder="Search blueprints (e.g. MERN, Shopify, MVP)..."
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Category Pills */}
                  <div className="flex flex-wrap gap-1 pt-2">
                    {PRESET_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedPresetCategory(cat)}
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all cursor-pointer",
                          selectedPresetCategory === cat
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-card hover:bg-muted border-border text-muted-foreground"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredPresets.map((p) => {
                      const isSelected = selectedPresetId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => applyPresetBlueprint(p)}
                          className={cn(
                            "rounded-xl border p-3.5 text-left transition-all cursor-pointer relative hover:shadow-sm",
                            isSelected
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                              : "border-border/80 bg-card hover:border-primary/50"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{p.icon}</span>
                              <h4 className="font-display font-semibold text-sm leading-tight">
                                {p.title}
                              </h4>
                            </div>
                            {isSelected && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] h-4 px-1.5 font-bold">
                                Active
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {p.description}
                          </p>

                          {/* Tech Stack Tags */}
                          {p.techStack && p.techStack.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {p.techStack.slice(0, 4).map((st) => (
                                <span
                                  key={st.id}
                                  className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-muted/70 border border-border/60 text-muted-foreground"
                                >
                                  {st.tech.split(" ")[0]}
                                </span>
                              ))}
                              {p.techStack.length > 4 && (
                                <span className="text-[9px] font-mono px-1 py-0.5 text-muted-foreground">
                                  +{p.techStack.length - 4} more
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] pt-2 border-t text-muted-foreground">
                            <span className="font-mono font-semibold text-foreground">
                              {p.defaultDurationValue} {p.defaultDurationUnit}
                            </span>
                            <span>{p.suggestedRoles.length} squad roles</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Stack & Employee Linker Panel */}
              {selectedPresetId && (
                <BlueprintStackLinker
                  selectedPreset={presets.find((p) => p.id === selectedPresetId) ?? null}
                  stackItems={activeStack}
                  employees={employees}
                  currency={currency}
                  onUpdateStackItem={(id, updates) =>
                    setActiveStack((prev) =>
                      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
                    )
                  }
                  onAddStackItem={(item) => setActiveStack((prev) => [...prev, item])}
                  onRemoveStackItem={(id) =>
                    setActiveStack((prev) => prev.filter((item) => item.id !== id))
                  }
                  onResetToDefault={() => {
                    const preset = presets.find((p) => p.id === selectedPresetId);
                    if (!preset?.techStack) return;
                    const linked = preset.techStack.map((item) => {
                      const emp = matchEmployeeForTech(
                        item.tech,
                        item.category,
                        employees,
                        item.suggestedEmployeeSubstr
                      );
                      return {
                        id: item.id,
                        tech: item.tech,
                        category: item.category,
                        roleLabel: item.roleLabel,
                        allocationPct: item.allocationPct,
                        employeeId: emp?.id ?? (employees[0]?.id ?? ""),
                      };
                    });
                    setActiveStack(linked);
                    setStackApplied(false);
                    toast.success("Stack reset to blueprint defaults.");
                  }}
                  onApplyToSquad={applyStackToSquad}
                  isApplied={stackApplied}
                />
              )}

              {/* Step 1 → Step 2 Navigation */}
              <div className="flex justify-end pt-2">
                <Button size="lg" onClick={nextStep} className="gap-2 font-semibold shadow-sm">
                  <span>Next: Define Scope & Features (Drag & Drop)</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ════ STEP 2: Scope & Features (Drag & Drop) ════ */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="rounded-xl border bg-gradient-to-br from-violet-500/10 via-card to-background p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🎯</span>
                  <h2 className="font-display font-bold text-lg">Step 2: Interactive Scope of Work Engine</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Drag and drop features into phase buckets or click to select. Effort hours per role and live loaded labor costs adjust dynamically from MySQL.
                </p>
              </div>

              <ScopeEngine
                companyId={companyId}
                projectName={inputs.projectName}
                employees={employees}
                currency={currency}
                marginPct={inputs.marginPct}
                salesCommissionPct={inputs.salesCommissionPct ?? 5}
                contingencyPct={inputs.contingencyPct}
                onApply={handleApplyScope}
              />

              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={prevStep} className="gap-1.5">
                  <ArrowLeft className="size-4" /> Previous: Project Basics
                </Button>
                <Button size="lg" onClick={nextStep} className="gap-2 font-semibold shadow-sm">
                  <span>Next: Team Squad & Allocations</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ════ STEP 3: Team & Allocations ════ */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="rounded-xl border bg-gradient-to-br from-violet-500/10 via-card to-background p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">👥</span>
                  <h2 className="font-display font-bold text-lg">Step 3: Team Squad & Phase Allocations</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fine-tune individual allocations, team durations, and milestone phases. Add available employees with loaded hourly rates.
                </p>
              </div>

              {/* Lifecycle Phase Engineering */}
              <CalculatorPhases
                phases={inputs.phases}
                employees={employees}
                rateFor={rateFor}
                currency={currency}
                onAddPhase={handleAddPhase}
                onAddPhaseTemplate={handleAddPhaseTemplate}
                onRemovePhase={handleRemovePhase}
                onUpdatePhaseName={handleUpdatePhaseName}
                onAddAllocation={handleAddAllocation}
                onUpdateAllocation={handleUpdateAllocation}
                onRemoveAllocation={handleRemoveAllocation}
              />

              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={prevStep} className="gap-1.5">
                  <ArrowLeft className="size-4" /> Previous: Scope & Features
                </Button>
                <Button size="lg" onClick={nextStep} className="gap-2 font-semibold shadow-sm">
                  <span>Next: Retainer, Extras & Risk</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ════ STEP 4: Retainer, Extras & Risk ════ */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="rounded-xl border bg-gradient-to-br from-violet-500/10 via-card to-background p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🛡️</span>
                  <h2 className="font-display font-bold text-lg">Step 4: Retainer, Extras, Risk & Pricing</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure post-launch maintenance, cloud software licenses, contingency buffer, company profit margin, and sales commission.
                </p>
              </div>

              <div className="space-y-4">
                {/* Support & Retainer */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-display text-base">Support & Maintenance Retainer</CardTitle>
                    <CardDescription className="text-xs">
                      Post-delivery retainer package with dedicated hours per month.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CalculatorSupport support={inputs.support} onChange={handleSupportChange} />
                  </CardContent>
                </Card>

                {/* Extras & Technology */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-display text-base">Additional Work & Technology Tools</CardTitle>
                    <CardDescription className="text-xs">
                      Third-party API subscriptions, AWS cloud hosting, and domain/SSL setup.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CalculatorExtras
                      additionalWork={inputs.additionalWork}
                      technology={inputs.technology}
                      onAddAdditionalWork={handleAddAdditionalWork}
                      onUpdateAdditionalWork={handleUpdateAdditionalWork}
                      onRemoveAdditionalWork={handleRemoveAdditionalWork}
                      onAddTechnology={handleAddTechnology}
                      onUpdateTechnology={handleUpdateTechnology}
                      onRemoveTechnology={handleRemoveTechnology}
                    />
                  </CardContent>
                </Card>

                {/* Risk & Pricing */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-display text-base">Risk Buffer, Margin & Sales Commission</CardTitle>
                    <CardDescription className="text-xs">
                      Set contingency %, target margin %, and sales commission (Ayesha Badar 5%).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CalculatorPricing
                      contingencyPct={inputs.contingencyPct}
                      pricingMode={inputs.pricingMode}
                      marginPct={inputs.marginPct}
                      markupPct={inputs.markupPct}
                      discountPct={inputs.discountPct}
                      salesCommissionPct={inputs.salesCommissionPct ?? 5}
                      notes={inputs.notes}
                      onChange={patch}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={prevStep} className="gap-1.5">
                  <ArrowLeft className="size-4" /> Previous: Team Squad
                </Button>
                <Button size="lg" onClick={nextStep} className="gap-2 font-semibold shadow-sm">
                  <span>Next: Executive Review & Proposal</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ════ STEP 5: Executive Review & Proposal ════ */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div className="rounded-xl border bg-gradient-to-br from-emerald-500/10 via-card to-background p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">📊</span>
                    <h2 className="font-display font-bold text-lg">Step 5: Executive Proposal & Rate Breakdown</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Complete executive rate matrix, department resource distribution, absorbed overhead statement, and financial waterfall.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsVersionHistoryOpen(true)}
                    className="gap-1.5 h-8 text-xs font-semibold"
                  >
                    <History className="size-3.5 text-primary" />
                    <span>Versions ({projectVersions.length})</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.print()}
                    className="gap-1.5 h-8 text-xs"
                  >
                    <Printer className="size-3.5" /> Print / PDF
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => save()}
                    disabled={saving || blocking}
                    className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                  >
                    <Save className="size-3.5" />
                    {saving
                      ? "Saving..."
                      : activeProjectId
                      ? `Save as v${(projectVersions[0]?.version ?? 0) + 1}`
                      : "Save Estimate to DB"}
                  </Button>
                </div>
              </div>

              {/* Full Executive Breakdown Component */}
              <DetailedBreakdownView
                inputs={inputs}
                results={results}
                currency={currency}
                employees={employees}
                overheads={overheads}
              />

              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={prevStep} className="gap-1.5">
                  <ArrowLeft className="size-4" /> Previous: Retainer & Risk
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setIsVersionHistoryOpen(true)}
                    className="gap-2 text-xs font-semibold"
                  >
                    <History className="size-4 text-primary" />
                    <span>Version History ({projectVersions.length})</span>
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => save()}
                    disabled={saving || blocking}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                  >
                    <Save className="size-4" />
                    <span>
                      {saving
                        ? "Saving to Database..."
                        : activeProjectId
                        ? `Save as Version ${(projectVersions[0]?.version ?? 0) + 1}`
                        : "Save & Finalize Estimate"}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ════ ALL-IN-ONE CLASSIC SINGLE PAGE VIEW ════ */
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-5">
              <CalculatorBasics
                projectName={inputs.projectName}
                clientName={inputs.clientName}
                description={inputs.description}
                onChange={patch}
              />

              <CalculatorPhases
                phases={inputs.phases}
                employees={employees}
                rateFor={rateFor}
                currency={currency}
                onAddPhase={handleAddPhase}
                onAddPhaseTemplate={handleAddPhaseTemplate}
                onRemovePhase={handleRemovePhase}
                onUpdatePhaseName={handleUpdatePhaseName}
                onAddAllocation={handleAddAllocation}
                onUpdateAllocation={handleUpdateAllocation}
                onRemoveAllocation={handleRemoveAllocation}
              />

              <Accordion type="multiple" className="space-y-4">
                <AccordionItem value="scope" className="rounded-md border bg-card px-4">
                  <AccordionTrigger className="font-display text-base">
                    ✨ Interactive Scope & Features Engine (Database Drag & Drop)
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <ScopeEngine
                      companyId={companyId}
                      projectName={inputs.projectName}
                      employees={employees}
                      currency={currency}
                      marginPct={inputs.marginPct}
                      salesCommissionPct={inputs.salesCommissionPct ?? 5}
                      contingencyPct={inputs.contingencyPct}
                      onApply={handleApplyScope}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="extras" className="rounded-md border bg-card px-4">
                  <AccordionTrigger className="font-display text-base">
                    3. Support, extra work & technology
                  </AccordionTrigger>
                  <AccordionContent className="space-y-5 pb-4">
                    <CalculatorSupport support={inputs.support} onChange={handleSupportChange} />
                    <CalculatorExtras
                      additionalWork={inputs.additionalWork}
                      technology={inputs.technology}
                      onAddAdditionalWork={handleAddAdditionalWork}
                      onUpdateAdditionalWork={handleUpdateAdditionalWork}
                      onRemoveAdditionalWork={handleRemoveAdditionalWork}
                      onAddTechnology={handleAddTechnology}
                      onUpdateTechnology={handleUpdateTechnology}
                      onRemoveTechnology={handleRemoveTechnology}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="pricing" className="rounded-md border bg-card px-4">
                  <AccordionTrigger className="font-display text-base">
                    4. Risk & pricing
                  </AccordionTrigger>
                  <AccordionContent>
                    <CalculatorPricing
                      contingencyPct={inputs.contingencyPct}
                      pricingMode={inputs.pricingMode}
                      marginPct={inputs.marginPct}
                      markupPct={inputs.markupPct}
                      discountPct={inputs.discountPct}
                      salesCommissionPct={inputs.salesCommissionPct ?? 5}
                      notes={inputs.notes}
                      onChange={patch}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <div>
              <CalculatorLiveResult
                currency={currency}
                results={results}
                contingencyPct={inputs.contingencyPct}
                issues={issues}
                saving={saving}
                blocking={blocking}
                onSave={save}
              />
            </div>
          </div>

          <div className="pt-6 border-t space-y-4">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <span>Executive Cost & Pricing Breakdown</span>
            </h2>
            <DetailedBreakdownView
              inputs={inputs}
              results={results}
              currency={currency}
              employees={employees}
              overheads={overheads}
            />
          </div>
        </div>
      )}

      {/* ── PERSISTENT STICKY WIZARD BAR (Bottom of screen) ── */}
      {viewMode === "wizard" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md px-4 py-2.5 shadow-lg">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            {/* Step info + Quick quote */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:block">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Cost Wizard Step {currentStep} of 5
                </span>
                <p className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                  {WIZARD_STEPS[currentStep - 1]?.title}
                </p>
              </div>

              <div className="h-6 w-px bg-border hidden sm:block" />

              {/* Financial preview */}
              <div className="flex items-center gap-3 text-xs">
                {activeProjectId && (
                  <button
                    onClick={() => setIsVersionHistoryOpen(true)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded border border-primary/30 bg-primary/10 hover:bg-primary/20 font-mono text-[11px] font-bold text-primary cursor-pointer transition-colors"
                    title="View all saved versions"
                  >
                    <History className="size-3" />
                    <span>v{loadedVersion || 1}</span>
                  </button>
                )}

                <div>
                  <span className="text-muted-foreground text-[10px]">Client Quote</span>
                  <div className="font-display font-bold text-sm text-primary">
                    {formatMoney(results.price, currency)}
                  </div>
                </div>

                <div className="hidden md:block">
                  <span className="text-muted-foreground text-[10px]">Total Effort</span>
                  <div className="font-mono font-semibold">
                    {results.totalHours}h ({Math.round(results.totalHours / 8)}d)
                  </div>
                </div>

                <div className="hidden lg:block">
                  <span className="text-muted-foreground text-[10px]">Net Return</span>
                  <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatMoney(results.profit, currency)} ({inputs.marginPct}%)
                  </div>
                </div>
              </div>
            </div>

            {/* Step controls */}
            <div className="flex items-center gap-2 ml-auto">
              {currentStep > 1 && (
                <Button size="sm" variant="outline" onClick={prevStep} className="h-8 gap-1 text-xs">
                  <ArrowLeft className="size-3.5" /> Back
                </Button>
              )}

              {currentStep < 5 ? (
                <Button size="sm" onClick={nextStep} className="h-8 gap-1.5 text-xs font-semibold shadow-xs">
                  <span>Next Step</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => save()}
                  disabled={saving || blocking}
                  className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <Save className="size-3.5" />
                  {saving
                    ? "Saving..."
                    : activeProjectId
                    ? `Save v${(projectVersions[0]?.version ?? 0) + 1}`
                    : "Save Estimate"}
                </Button>
              )}

              {currentStep !== 5 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => goToStep(5)}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                >
                  Jump to Review ➔
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Estimate Version History Modal ── */}
      <VersionHistoryModal
        open={isVersionHistoryOpen}
        onOpenChange={setIsVersionHistoryOpen}
        projectId={activeProjectId}
        currentVersion={loadedVersion}
        currency={currency}
        onSelectVersion={handleSelectVersion}
        onSaveNewVersion={async (label) => {
          await save(label);
        }}
        isSaving={saving}
      />

      {/* ── Feature Library & JSON Hub ── */}
      <FeatureLibraryManager
        open={isLibraryManagerOpen}
        onOpenChange={setIsLibraryManagerOpen}
        companyId={companyId}
      />
    </div>
  );
}
