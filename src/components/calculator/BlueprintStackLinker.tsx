import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { formatMoney } from "@/lib/pricing";
import type { TeamRate } from "@/lib/workspace";
import type { PresetConfig, StackCategory, LinkedStackItem } from "./qce/types";
import {
  Code2,
  Server,
  Smartphone,
  Database,
  Palette,
  Cloud,
  ShieldCheck,
  Briefcase,
  Cpu,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  Sparkles,
  Layers,
  RotateCcw,
  Clock,
  Check,
  ArrowRight,
  HelpCircle,
  Sliders,
  DollarSign,
} from "lucide-react";

// ─── Popular Tech Templates for Quick-Add ─────────────────────────────────────
export const POPULAR_TECH_TEMPLATES: Array<{
  tech: string;
  category: StackCategory;
  roleLabel: string;
  defaultPct: number;
}> = [
  // Frontend
  {
    tech: "React & Next.js",
    category: "frontend",
    roleLabel: "Frontend Web Developer",
    defaultPct: 80,
  },
  { tech: "Vue.js & Nuxt", category: "frontend", roleLabel: "Frontend Engineer", defaultPct: 70 },
  { tech: "Angular Web App", category: "frontend", roleLabel: "Angular Developer", defaultPct: 70 },
  {
    tech: "Tailwind CSS & UI Components",
    category: "frontend",
    roleLabel: "UI Styling Specialist",
    defaultPct: 50,
  },
  {
    tech: "TypeScript & Tooling",
    category: "frontend",
    roleLabel: "Frontend Architecture",
    defaultPct: 50,
  },

  // Backend
  {
    tech: "Node.js & Express REST API",
    category: "backend",
    roleLabel: "REST API Backend Dev",
    defaultPct: 80,
  },
  {
    tech: "PHP & Laravel 11 Framework",
    category: "backend",
    roleLabel: "Laravel Backend Developer",
    defaultPct: 80,
  },
  {
    tech: "Python & FastAPI Microservices",
    category: "backend",
    roleLabel: "Python Backend Developer",
    defaultPct: 70,
  },
  {
    tech: "Go / Golang Services",
    category: "backend",
    roleLabel: "High-Performance Backend Dev",
    defaultPct: 70,
  },
  {
    tech: "GraphQL API & Apollo",
    category: "backend",
    roleLabel: "GraphQL API Engineer",
    defaultPct: 60,
  },

  // Mobile
  {
    tech: "Flutter Cross-Platform App",
    category: "mobile",
    roleLabel: "Cross-Platform Mobile Dev",
    defaultPct: 100,
  },
  {
    tech: "React Native Mobile App",
    category: "mobile",
    roleLabel: "React Native Mobile Dev",
    defaultPct: 100,
  },
  {
    tech: "iOS Native (Swift/SwiftUI)",
    category: "mobile",
    roleLabel: "iOS Native Developer",
    defaultPct: 80,
  },
  {
    tech: "Android Native (Kotlin)",
    category: "mobile",
    roleLabel: "Android Native Developer",
    defaultPct: 80,
  },

  // Database
  {
    tech: "PostgreSQL Relational DB",
    category: "database",
    roleLabel: "Database Schema Architect",
    defaultPct: 40,
  },
  {
    tech: "MongoDB NoSQL Cloud",
    category: "database",
    roleLabel: "Document Database Specialist",
    defaultPct: 40,
  },
  {
    tech: "MySQL Relational Database",
    category: "database",
    roleLabel: "MySQL Schema & Optimization",
    defaultPct: 40,
  },
  {
    tech: "Redis In-Memory Cache",
    category: "database",
    roleLabel: "Caching & PubSub Engineer",
    defaultPct: 30,
  },

  // Design
  {
    tech: "Figma UI/UX & Design System",
    category: "design",
    roleLabel: "Lead UI/UX Designer",
    defaultPct: 50,
  },
  {
    tech: "User Research & Wireframing",
    category: "design",
    roleLabel: "UX Researcher & Wireframer",
    defaultPct: 40,
  },
  {
    tech: "Interactive Motion & Prototyping",
    category: "design",
    roleLabel: "Motion & Prototype Designer",
    defaultPct: 40,
  },

  // DevOps & Cloud
  {
    tech: "Docker & Containerization",
    category: "devops",
    roleLabel: "DevOps & CI/CD Lead",
    defaultPct: 30,
  },
  {
    tech: "AWS Cloud Infrastructure",
    category: "devops",
    roleLabel: "Cloud Solutions Architect",
    defaultPct: 40,
  },
  {
    tech: "CI/CD Pipelines & Automation",
    category: "devops",
    roleLabel: "Release Engineer",
    defaultPct: 25,
  },

  // QA & Testing
  {
    tech: "E2E Cypress / Playwright QA",
    category: "qa",
    roleLabel: "Automated QA Specialist",
    defaultPct: 40,
  },
  {
    tech: "Manual Device & Regression QA",
    category: "qa",
    roleLabel: "Manual QA Tester",
    defaultPct: 40,
  },
  {
    tech: "API & Load Testing",
    category: "qa",
    roleLabel: "Performance & QA Tester",
    defaultPct: 30,
  },

  // CMS & E-Commerce
  {
    tech: "Shopify Liquid & Apps",
    category: "frontend",
    roleLabel: "Shopify Theme Specialist",
    defaultPct: 60,
  },
  {
    tech: "WordPress Custom Theme & ACF",
    category: "backend",
    roleLabel: "WordPress CMS Developer",
    defaultPct: 60,
  },

  // AI & Emerging
  {
    tech: "AI / LLM API & Agent Integration",
    category: "backend",
    roleLabel: "AI Integration Engineer",
    defaultPct: 50,
  },
  {
    tech: "Vector DB & RAG Pipeline",
    category: "database",
    roleLabel: "RAG & Search Specialist",
    defaultPct: 40,
  },
];

// ─── Category Metadata Helper ────────────────────────────────────────────────
export function getCategoryMeta(category: StackCategory) {
  switch (category) {
    case "frontend":
      return {
        label: "Frontend & UI",
        icon: <Code2 className="size-3.5 text-foreground" />,
        badgeClass: "bg-muted text-foreground border-border dark:border-border",
      };
    case "backend":
      return {
        label: "Backend & API",
        icon: <Server className="size-3.5 text-foreground" />,
        badgeClass: "bg-muted text-foreground border-border dark:border-border",
      };
    case "mobile":
      return {
        label: "Mobile Apps",
        icon: <Smartphone className="size-3.5 text-destructive" />,
        badgeClass: "bg-destructive/10 text-destructive border-destructive dark:border-destructive",
      };
    case "database":
      return {
        label: "Database & Storage",
        icon: <Database className="size-3.5 text-foreground" />,
        badgeClass: "bg-muted text-foreground border-border dark:border-border",
      };
    case "design":
      return {
        label: "UI/UX & Creative",
        icon: <Palette className="size-3.5 text-foreground" />,
        badgeClass: "bg-muted text-foreground border-border dark:border-border",
      };
    case "devops":
      return {
        label: "DevOps & Architecture",
        icon: <Cloud className="size-3.5 text-warning" />,
        badgeClass: "bg-warning/10 text-warning border-warning dark:border-warning",
      };
    case "qa":
      return {
        label: "QA & Testing",
        icon: <ShieldCheck className="size-3.5 text-foreground" />,
        badgeClass: "bg-muted text-foreground border-border dark:border-border",
      };
    case "management":
      return {
        label: "Management & Delivery",
        icon: <Briefcase className="size-3.5 text-foreground" />,
        badgeClass: "bg-muted text-foreground border-border dark:border-border",
      };
    default:
      return {
        label: "Other Tech",
        icon: <Cpu className="size-3.5 text-foreground" />,
        badgeClass: "bg-muted text-muted-foreground border-border",
      };
  }
}

// ─── Skill Matching Functions ────────────────────────────────────────────────
export function isSkillMatch(emp: TeamRate, tech: string, category?: StackCategory): boolean {
  const techLower = tech.toLowerCase();

  // 1. Check explicit employee skills array
  const hasSkill = (emp.skills || []).some((s) => {
    const sLower = s.toLowerCase();
    return techLower.includes(sLower) || sLower.includes(techLower);
  });
  if (hasSkill) return true;

  // 2. Check employee job title
  const title = (emp.job_title || "").toLowerCase();
  if (
    (techLower.includes("react") && title.includes("react")) ||
    (techLower.includes("next") && (title.includes("react") || title.includes("frontend"))) ||
    (techLower.includes("laravel") && title.includes("laravel")) ||
    (techLower.includes("php") && (title.includes("laravel") || title.includes("php"))) ||
    (techLower.includes("mobile") && title.includes("mobile")) ||
    (techLower.includes("flutter") && title.includes("mobile")) ||
    (techLower.includes("ios") && title.includes("mobile")) ||
    (techLower.includes("android") && title.includes("mobile")) ||
    (techLower.includes("design") && title.includes("design")) ||
    (techLower.includes("figma") && (title.includes("design") || title.includes("ui"))) ||
    (techLower.includes("qa") && (title.includes("qa") || title.includes("test"))) ||
    (techLower.includes("scrum") && title.includes("project manager")) ||
    (techLower.includes("delivery") && title.includes("project manager")) ||
    (techLower.includes("architecture") && (title.includes("architect") || title.includes("lead")))
  ) {
    return true;
  }

  // 3. Check category fallback
  if (category) {
    const dept = (emp.department || "").toLowerCase();
    if (category === "design" && (dept === "design" || title.includes("design"))) return true;
    if (category === "qa" && (title.includes("qa") || title.includes("test"))) return true;
    if (category === "management" && (dept === "management" || title.includes("manager")))
      return true;
  }

  return false;
}

export function matchEmployeeForTech(
  techName: string,
  category: StackCategory,
  employees: TeamRate[],
  fallbackSubstr?: string,
): TeamRate | undefined {
  // Check direct fallback name substring
  if (fallbackSubstr) {
    const direct = employees.find((e) =>
      e.name.toLowerCase().includes(fallbackSubstr.toLowerCase()),
    );
    if (direct) return direct;
  }

  const techLower = techName.toLowerCase();

  // Search by explicit skills
  const bySkill = employees.find((e) =>
    (e.skills || []).some((s) => {
      const sLower = s.toLowerCase();
      return techLower.includes(sLower) || sLower.includes(techLower);
    }),
  );
  if (bySkill) return bySkill;

  // Search by category keywords
  const kwByCategory: Record<StackCategory, string[]> = {
    frontend: ["frontend", "front-end", "react", "mern", "next", "vue"],
    backend: ["backend", "back-end", "laravel", "php", "node", "api", "python"],
    mobile: ["mobile", "flutter", "react native", "android", "ios"],
    database: ["database", "mongodb", "mysql", "backend"],
    design: ["design", "ui", "ux", "figma", "visual"],
    devops: ["devops", "cloud", "architect", "lead"],
    qa: ["qa", "quality", "test", "tester"],
    management: ["project manager", "manager", "pm", "scrum", "director"],
    other: ["engineer", "developer"],
  };

  const words = kwByCategory[category] || [];
  return employees.find((e) => {
    const hay = `${e.name} ${e.job_title ?? ""} ${e.department ?? ""}`.toLowerCase();
    return words.some((w) => hay.includes(w));
  });
}

// ─── Component Props ──────────────────────────────────────────────────────────
export interface BlueprintStackLinkerProps {
  selectedPreset: PresetConfig | null;
  stackItems: LinkedStackItem[];
  employees: TeamRate[];
  currency: string;
  onUpdateStackItem: (id: string, updates: Partial<LinkedStackItem>) => void;
  onAddStackItem: (item: LinkedStackItem) => void;
  onRemoveStackItem: (id: string) => void;
  onResetToDefault: () => void;
  onApplyToSquad: () => void;
  isApplied?: boolean;
}

export const BlueprintStackLinker: React.FC<BlueprintStackLinkerProps> = ({
  selectedPreset,
  stackItems,
  employees,
  currency,
  onUpdateStackItem,
  onAddStackItem,
  onRemoveStackItem,
  onResetToDefault,
  onApplyToSquad,
  isApplied = false,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [customTech, setCustomTech] = useState("");
  const [customCategory, setCustomCategory] = useState<StackCategory>("frontend");
  const [customRole, setCustomRole] = useState("");
  const [customEmployeeId, setCustomEmployeeId] = useState("");
  const [customPct, setCustomPct] = useState(80);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("all");

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const uniqueEmployees = new Set(stackItems.map((s) => s.employeeId).filter(Boolean));
    const totalHeadcount = uniqueEmployees.size;

    let totalCostWeight = 0;
    let totalPctWeight = 0;

    for (const item of stackItems) {
      const emp = employees.find((e) => e.id === item.employeeId);
      if (emp && item.allocationPct > 0) {
        totalCostWeight += emp.hourly_cost * (item.allocationPct / 100);
        totalPctWeight += item.allocationPct / 100;
      }
    }

    const blendedHourly = totalPctWeight > 0 ? totalCostWeight / totalPctWeight : 0;
    return {
      layersCount: stackItems.length,
      headcount: totalHeadcount,
      blendedHourly,
    };
  }, [stackItems, employees]);

  // Handle template selection in Add dialog
  const handleSelectTemplate = (template: (typeof POPULAR_TECH_TEMPLATES)[0]) => {
    setCustomTech(template.tech);
    setCustomCategory(template.category);
    setCustomRole(template.roleLabel);
    setCustomPct(template.defaultPct);

    // Auto-match best employee
    const matched = matchEmployeeForTech(template.tech, template.category, employees);
    if (matched) {
      setCustomEmployeeId(matched.id);
    }
  };

  // Submit custom stack item
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTech.trim()) {
      toast.error("Please enter a technology name or choose a template.");
      return;
    }

    const matchedEmp = customEmployeeId
      ? employees.find((e) => e.id === customEmployeeId)
      : matchEmployeeForTech(customTech, customCategory, employees);

    const newItem: LinkedStackItem = {
      id: `st-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tech: customTech.trim(),
      category: customCategory,
      roleLabel: customRole.trim() || `${customTech} Specialist`,
      allocationPct: customPct,
      employeeId: matchedEmp?.id || (employees[0]?.id ?? ""),
    };

    onAddStackItem(newItem);
    setIsAddModalOpen(false);
    setCustomTech("");
    setCustomRole("");
    toast.success(`Added "${newItem.tech}" linked with ${matchedEmp?.name || "team member"}!`);
  };

  if (!selectedPreset) {
    return null;
  }

  return (
    <Card className="border-primary/30 bg-card shadow-sm overflow-hidden animate-in fade-in-50 duration-200">
      {/* ── Header Banner ── */}
      <CardHeader className="from-primary/10 via-card to-background border-b pb-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                {selectedPreset.icon}
              </span>
              <div>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <span>{selectedPreset.title}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-primary/30 text-primary"
                  >
                    {selectedPreset.badge}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure the tech stack layers and match each technology with specialized company
                  talent.
                </CardDescription>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResetToDefault}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" />
              <span>Reset Defaults</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCustomTech("");
                setCustomRole("");
                setCustomEmployeeId(employees[0]?.id || "");
                setIsAddModalOpen(true);
              }}
              className="h-8 gap-1.5 text-xs font-semibold border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary"
            >
              <Plus className="size-3.5" />
              <span>Add Stack Technology</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={onApplyToSquad}
              className="h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              <Sparkles className="size-3.5" />
              <span>Apply Stack to Squad</span>
            </Button>
          </div>
        </div>

        {/* ── Stats Summary Bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-2 border-t border-border/60">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-card border text-xs">
            <Layers className="size-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Tech Stack Layers</p>
              <p className="font-bold font-mono">{summaryMetrics.layersCount} technologies</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-card border text-xs">
            <Users className="size-4 text-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Linked Squad Size</p>
              <p className="font-bold font-mono">{summaryMetrics.headcount} members</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-card border text-xs">
            <DollarSign className="size-4 text-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Blended Hourly Rate</p>
              <p className="font-bold font-mono text-foreground">
                {formatMoney(summaryMetrics.blendedHourly, currency)}/hr
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-card border text-xs">
            <Clock className="size-4 text-warning shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Estimated Timeline</p>
              <p className="font-bold font-mono text-foreground">
                {selectedPreset.defaultDurationValue} {selectedPreset.defaultDurationUnit}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* ── Stack & Employee Linker List ── */}
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <span>Configured Stack Technologies & Assigned Employees</span>
            <span className="text-[10px] lowercase text-muted-foreground">
              ({stackItems.length})
            </span>
          </span>

          {isApplied && (
            <Badge
              variant="outline"
              className="bg-muted text-foreground border-border text-[10px] gap-1"
            >
              <CheckCircle2 className="size-3" />
              Synced with Step 3 Squad
            </Badge>
          )}
        </div>

        {stackItems.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed rounded-xl bg-muted/20">
            <Layers className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-xs font-semibold">No stack technologies added yet</p>
            <p className="text-[11px] text-muted-foreground mb-3">
              Add technologies to define the tech stack and link engineers.
            </p>
            <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Add Technology
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {stackItems.map((item) => {
              const meta = getCategoryMeta(item.category);
              const assignedEmp = employees.find((e) => e.id === item.employeeId);
              const hasMatch = assignedEmp
                ? isSkillMatch(assignedEmp, item.tech, item.category)
                : false;

              return (
                <div
                  key={item.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl border bg-card hover:border-primary/40 transition-colors"
                >
                  {/* Technology & Role Details */}
                  <div className="min-w-0 flex-1 flex items-start gap-3">
                    <div className="mt-0.5 p-2 rounded-lg bg-muted/60 shrink-0">{meta.icon}</div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {item.tech}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 font-medium ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          aria-label={`Role responsibility for ${item.tech}`}
                          value={item.roleLabel}
                          onChange={(e) =>
                            onUpdateStackItem(item.id, { roleLabel: e.target.value })
                          }
                          placeholder="Role responsibility..."
                          className="h-6 text-[11px] w-full max-w-xs bg-transparent border-dashed px-1.5 focus:border-solid text-muted-foreground hover:text-foreground"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Linked Employee Selector */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-full sm:w-64">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">Linked Employee</span>
                        {hasMatch ? (
                          <span className="text-foreground dark:text-muted-foreground font-semibold flex items-center gap-0.5">
                            <Check className="size-3" />
                            Skill Match
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Manual Assignment</span>
                        )}
                      </div>

                      <Select
                        value={item.employeeId}
                        onValueChange={(val) => onUpdateStackItem(item.id, { employeeId: val })}
                      >
                        <SelectTrigger className="h-8 text-xs bg-background">
                          <SelectValue placeholder="Assign employee...">
                            {assignedEmp ? (
                              <div className="flex items-center justify-between w-full pr-2 text-left truncate">
                                <span className="font-semibold truncate">{assignedEmp.name}</span>
                                <span className="text-[10px] font-mono text-muted-foreground ml-1 shrink-0">
                                  {formatMoney(assignedEmp.hourly_cost, currency)}/hr
                                </span>
                              </div>
                            ) : (
                              "Assign employee"
                            )}
                          </SelectValue>
                        </SelectTrigger>

                        <SelectContent className="max-h-72">
                          {employees.map((emp) => {
                            const empMatches = isSkillMatch(emp, item.tech, item.category);
                            return (
                              <SelectItem key={emp.id} value={emp.id} className="text-xs py-1.5">
                                <div className="flex items-center justify-between w-full gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-foreground truncate">
                                        {emp.name}
                                      </span>
                                      {empMatches && (
                                        <Badge className="bg-muted text-foreground border-border text-[9px] h-3.5 px-1">
                                          Match
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {emp.job_title || "Team Member"}
                                    </p>
                                  </div>
                                  <span className="font-mono text-[11px] font-semibold text-foreground shrink-0">
                                    {formatMoney(emp.hourly_cost, currency)}/hr
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Allocation % Slider / Control */}
                    <div className="w-28 text-right">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">Allocation</span>
                        <span className="font-mono font-bold text-primary">
                          {item.allocationPct}%
                        </span>
                      </div>
                      <Slider
                        value={[item.allocationPct]}
                        min={10}
                        max={100}
                        step={5}
                        onValueChange={([val]) => {
                          if (val !== undefined) {
                            onUpdateStackItem(item.id, { allocationPct: val });
                          }
                        }}
                        className="w-full"
                      />
                    </div>

                    {/* Remove button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveStackItem(item.id)}
                      className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      title="Remove technology"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">Remove {item.tech}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Fast Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t text-xs text-muted-foreground">
          <span className="text-[11px]">
            Stack choices populate <strong>Engineering, UI/UX, and QA phases</strong> with
            designated hourly budgets.
          </span>

          <Button
            type="button"
            size="sm"
            onClick={onApplyToSquad}
            className="w-full sm:w-auto h-8 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
          >
            <Sparkles className="size-3.5" />
            <span>Apply Stack & Sync Team</span>
          </Button>
        </div>
      </CardContent>

      {/* ── Dialog: Add Technology & Link Employee ── */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              <span>Add Stack Technology & Link Employee</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select from curated tech stack modules or enter a custom framework, then link with a
              qualified engineer.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="space-y-4 pt-2">
            {/* Quick Templates Filter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Choose from Popular Stacks:</span>
                <div className="flex gap-1">
                  {["all", "frontend", "backend", "mobile", "database", "design"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategoryFilter(cat)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                        activeCategoryFilter === cat
                          ? "bg-primary text-primary-foreground border-primary font-bold"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Chips */}
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 rounded-lg border bg-muted/30">
                {POPULAR_TECH_TEMPLATES.filter(
                  (t) => activeCategoryFilter === "all" || t.category === activeCategoryFilter,
                ).map((t) => (
                  <button
                    key={t.tech}
                    type="button"
                    onClick={() => handleSelectTemplate(t)}
                    className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-all cursor-pointer ${
                      customTech === t.tech
                        ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                        : "bg-background hover:bg-muted text-foreground border-border"
                    }`}
                  >
                    <span>{t.tech}</span>
                    <span className="text-[10px] opacity-70">({t.defaultPct}%)</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Technology Name</label>
                <Input
                  aria-label="Technology Name"
                  value={customTech}
                  onChange={(e) => setCustomTech(e.target.value)}
                  placeholder="e.g. Next.js 15, FastAPI, Docker..."
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">Category</label>
                <Select
                  value={customCategory}
                  onValueChange={(val: StackCategory) => setCustomCategory(val)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frontend">Frontend & UI</SelectItem>
                    <SelectItem value="backend">Backend & API</SelectItem>
                    <SelectItem value="mobile">Mobile Apps</SelectItem>
                    <SelectItem value="database">Database & Storage</SelectItem>
                    <SelectItem value="design">UI/UX & Creative</SelectItem>
                    <SelectItem value="devops">DevOps & Cloud</SelectItem>
                    <SelectItem value="qa">QA & Testing</SelectItem>
                    <SelectItem value="management">Management & Delivery</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium">Role Responsibility Label</label>
                <Input
                  aria-label="Role Responsibility Label"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="e.g. Lead Frontend Engineer & Architecture"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium">Link with Employee</label>
                <Select value={customEmployeeId} onValueChange={setCustomEmployeeId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {employees.map((emp) => {
                      const matches = customTech
                        ? isSkillMatch(emp, customTech, customCategory)
                        : false;
                      return (
                        <SelectItem key={emp.id} value={emp.id} className="text-xs py-1.5">
                          <div className="flex items-center justify-between w-full gap-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-semibold text-foreground truncate">
                                {emp.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate">
                                ({emp.job_title || "Team Member"})
                              </span>
                              {matches && (
                                <Badge className="bg-muted text-foreground border-border text-[9px] h-3.5 px-1">
                                  Match
                                </Badge>
                              )}
                            </div>
                            <span className="font-mono text-xs font-semibold text-foreground shrink-0">
                              {formatMoney(emp.hourly_cost, currency)}/hr
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Planned Allocation</span>
                  <span className="font-mono font-bold text-primary">{customPct}%</span>
                </div>
                <Slider
                  value={[customPct]}
                  min={10}
                  max={100}
                  step={5}
                  onValueChange={([val]) => {
                    if (val !== undefined) setCustomPct(val);
                  }}
                  className="w-full"
                />
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="size-3.5" />
                <span>Add to Blueprint Stack</span>
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
