import React, { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logActivity, useScopeFeatures, type ScopeFeatureRecord } from "@/lib/workspace";
import { downloadCsv } from "@/lib/csv";
import {
  FEATURE_LIBRARY,
  type FeatureCategory,
  type FeatureEffort,
  type Complexity,
} from "./featureLibrary";
import {
  BookOpen,
  Download,
  Upload,
  FileCode2,
  Copy,
  Check,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Layers,
  ArrowRight,
} from "lucide-react";
import { CategoryGlyph } from "./CategoryGlyph";

const FEATURE_CSV_COLUMNS = [
  "id",
  "category",
  "label",
  "description",
  "tags",
  "lowEffort",
  "mediumEffort",
  "highEffort",
] as const;

/** One row per feature; the three effort tiers ride along as JSON cells. */
function featuresToCsvRows(list: ScopeFeatureRecord[]) {
  const tier = (effort: ScopeFeatureRecord["effort"], key: string) =>
    JSON.stringify((effort as Record<string, unknown> | null)?.[key] ?? {});
  return list.map((f) => ({
    id: f.id,
    category: f.category,
    label: f.label,
    description: f.description ?? "",
    tags: Array.isArray(f.tags) ? f.tags.join("; ") : "",
    lowEffort: tier(f.effort, "low"),
    mediumEffort: tier(f.effort, "medium"),
    highEffort: tier(f.effort, "high"),
  }));
}

const CATEGORIES: { key: FeatureCategory | "all"; label: string }[] = [
  { key: "all", label: "All Categories" },
  { key: "discovery", label: "Discovery & Strategy" },
  { key: "design", label: "UI/UX Design" },
  { key: "frontend", label: "Frontend & Web" },
  { key: "backend", label: "Backend & APIs" },
  { key: "mobile", label: "Mobile Apps" },
  { key: "ecommerce", label: "E-Commerce" },
  { key: "integration", label: "Integrations & SaaS" },
  { key: "devops", label: "DevOps & Cloud" },
  { key: "testing", label: "QA & Testing" },
  { key: "cms", label: "CMS & Portals" },
  { key: "social", label: "Social & Marketing" },
];

const createManualForm = () => ({
  label: "",
  category: "frontend" as FeatureCategory,
  description: "",
  tags: "",
  designer: 4,
  frontend: 16,
  backend: 8,
  mobile: 0,
  pm: 4,
  qa: 4,
});

const STANDARD_FEATURES: ScopeFeatureRecord[] = FEATURE_LIBRARY.map((feature, index) => ({
  ...feature,
  company_id: null,
  sort_order: index,
  is_custom: false,
}));

const SAMPLE_TEMPLATE_JSON = `[
 {
 "category": "frontend",
 "label": "Interactive Analytics Dashboard",
 "description": "Custom analytics dashboard with KPI cards, filtering, and exportable charts",
 "icon": "",
 "tags": ["dashboard", "analytics", "charts", "kpi"],
 "effort": {
 "designer": 6,
 "frontend": 24,
 "backend": 12,
 "mobile": 0,
 "pm": 4,
 "qa": 6
 }
 },
 {
 "category": "backend",
 "label": "Stripe Subscriptions & Invoicing",
 "description": "Recurring subscription billing, customer portal, webhook handlers, and invoice emails",
 "icon": "",
 "tags": ["billing", "stripe", "payments", "subscriptions"],
 "effort": {
 "low": { "designer": 0, "frontend": 8, "backend": 16, "mobile": 0, "pm": 2, "qa": 4 },
 "medium": { "designer": 2, "frontend": 16, "backend": 32, "mobile": 0, "pm": 4, "qa": 8 },
 "high": { "designer": 4, "frontend": 32, "backend": 64, "mobile": 0, "pm": 8, "qa": 16 }
 }
 },
 {
 "category": "mobile",
 "label": "Biometric Authentication & Push Notifications",
 "description": "FaceID / fingerprint login and Firebase Cloud Messaging for iOS and Android",
 "icon": "",
 "tags": ["mobile", "auth", "security", "push"],
 "effort": {
 "designer": 2,
 "frontend": 0,
 "backend": 8,
 "mobile": 20,
 "pm": 3,
 "qa": 6
 }
 }
]`;

interface FeatureLibraryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string | null | undefined;
  canManage?: boolean;
}

export function FeatureLibraryManager({
  open,
  onOpenChange,
  companyId,
  canManage = true,
}: FeatureLibraryManagerProps) {
  const queryClient = useQueryClient();
  const { data: dbFeatures = [], isLoading } = useScopeFeatures(companyId ?? undefined);
  const features = useMemo(() => {
    const databaseIds = new Set(dbFeatures.map((feature) => feature.id));
    return [...STANDARD_FEATURES.filter((feature) => !databaseIds.has(feature.id)), ...dbFeatures];
  }, [dbFeatures]);

  const [showTransfer, setShowTransfer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FeatureCategory | "all">("all");
  const [filterCustomOnly, setFilterCustomOnly] = useState<"all" | "custom" | "standard">("all");

  // JSON Import states
  const [jsonText, setJsonText] = useState("");
  const [parsedItems, setParsedItems] = useState<any[] | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);

  // Manual Add Form Modal state
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [editingFeature, setEditingFeature] = useState<ScopeFeatureRecord | null>(null);
  const [manualForm, setManualForm] = useState(createManualForm);

  // Filtered features for Browse tab
  const filteredFeatures = useMemo(() => {
    return features.filter((f) => {
      const matchCat = selectedCategory === "all" || f.category === selectedCategory;
      const matchCustom =
        filterCustomOnly === "all"
          ? true
          : filterCustomOnly === "custom"
            ? Boolean(f.is_custom)
            : !f.is_custom;
      const matchSearch =
        !searchQuery.trim() ||
        f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (Array.isArray(f.tags) &&
          f.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));
      return matchCat && matchCustom && matchSearch;
    });
  }, [features, selectedCategory, filterCustomOnly, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = features.length;
    const custom = features.filter((f) => f.is_custom).length;
    const standard = total - custom;
    return { total, custom, standard };
  }, [features]);

  // Copy template JSON
  const handleCopyTemplate = useCallback(() => {
    navigator.clipboard.writeText(SAMPLE_TEMPLATE_JSON);
    setCopiedTemplate(true);
    toast.success("Sample JSON template copied to clipboard!");
    setTimeout(() => setCopiedTemplate(false), 2000);
  }, []);

  // Download template file
  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([SAMPLE_TEMPLATE_JSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "costcraft-features-template.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template file downloaded: costcraft-features-template.json");
  }, []);

  // Validate JSON string
  const handleValidateJson = useCallback(() => {
    setValidationErrors([]);
    setParsedItems(null);

    if (!jsonText.trim()) {
      setValidationErrors(["Please paste or enter JSON content."]);
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e: any) {
      setValidationErrors([`Invalid JSON syntax: ${e.message}`]);
      return;
    }

    const items = Array.isArray(parsed) ? parsed : [parsed];
    const errors: string[] = [];
    const validRecords: Partial<ScopeFeatureRecord>[] = [];

    items.forEach((item, index) => {
      const idx = `Item #${index + 1}`;
      if (!item || typeof item !== "object") {
        errors.push(`${idx} must be a valid JSON object.`);
        return;
      }
      if (!item.label || typeof item.label !== "string" || !item.label.trim()) {
        errors.push(`${idx} is missing a valid "label" property.`);
        return;
      }

      const category = (item.category || "frontend").toLowerCase();
      const validCategories = [
        "discovery",
        "design",
        "frontend",
        "backend",
        "mobile",
        "ecommerce",
        "integration",
        "devops",
        "testing",
        "cms",
        "social",
      ];
      const finalCategory = validCategories.includes(category) ? category : "frontend";

      // Normalize effort structure
      let effortObj: Record<Complexity, FeatureEffort>;
      if (item.effort && item.effort.medium) {
        // Full 3-tier effort provided
        effortObj = {
          low: {
            designer: Number(item.effort.low?.designer) || 0,
            frontend: Number(item.effort.low?.frontend) || 0,
            backend: Number(item.effort.low?.backend) || 0,
            mobile: Number(item.effort.low?.mobile) || 0,
            pm: Number(item.effort.low?.pm) || 0,
            qa: Number(item.effort.low?.qa) || 0,
          },
          medium: {
            designer: Number(item.effort.medium?.designer) || 0,
            frontend: Number(item.effort.medium?.frontend) || 0,
            backend: Number(item.effort.medium?.backend) || 0,
            mobile: Number(item.effort.medium?.mobile) || 0,
            pm: Number(item.effort.medium?.pm) || 0,
            qa: Number(item.effort.medium?.qa) || 0,
          },
          high: {
            designer: Number(item.effort.high?.designer) || 0,
            frontend: Number(item.effort.high?.frontend) || 0,
            backend: Number(item.effort.high?.backend) || 0,
            mobile: Number(item.effort.high?.mobile) || 0,
            pm: Number(item.effort.high?.pm) || 0,
            qa: Number(item.effort.high?.qa) || 0,
          },
        };
      } else {
        // Shorthand single-tier effort provided
        const base = item.effort || {};
        const baseEffort: FeatureEffort = {
          designer: Number(base.designer) || 0,
          frontend: Number(base.frontend) || 0,
          backend: Number(base.backend) || 0,
          mobile: Number(base.mobile) || 0,
          pm: Number(base.pm) || 0,
          qa: Number(base.qa) || 0,
        };
        effortObj = {
          low: {
            designer: Math.round(baseEffort.designer * 0.5),
            frontend: Math.round(baseEffort.frontend * 0.5),
            backend: Math.round(baseEffort.backend * 0.5),
            mobile: Math.round(baseEffort.mobile * 0.5),
            pm: Math.round(baseEffort.pm * 0.5),
            qa: Math.round(baseEffort.qa * 0.5),
          },
          medium: baseEffort,
          high: {
            designer: Math.round(baseEffort.designer * 2),
            frontend: Math.round(baseEffort.frontend * 2),
            backend: Math.round(baseEffort.backend * 2),
            mobile: Math.round(baseEffort.mobile * 2),
            pm: Math.round(baseEffort.pm * 2),
            qa: Math.round(baseEffort.qa * 2),
          },
        };
      }

      const tagsArray = Array.isArray(item.tags)
        ? item.tags.map((t: any) => String(t).trim()).filter(Boolean)
        : typeof item.tags === "string"
          ? item.tags
              .split(",")
              .map((t: string) => t.trim())
              .filter(Boolean)
          : [];

      const record: Partial<ScopeFeatureRecord> = {
        id: item.id || `feat-custom-${crypto.randomUUID()}`,
        company_id: companyId ?? null,
        category: finalCategory,
        label: item.label.trim(),
        description: item.description?.trim() || "",
        effort: effortObj,
        icon: item.icon || "",
        tags: tagsArray,
        sort_order: 999,
        is_custom: true,
      };

      validRecords.push(record);
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      toast.error(`Found ${errors.length} errors in your JSON.`);
    } else {
      setParsedItems(validRecords);
      toast.success(`All ${validRecords.length} features parsed and valid! Ready to import.`);
    }
  }, [jsonText, companyId]);

  // File upload reader
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setJsonText(content);
        toast.info(`Loaded ${file.name}. Click "Validate & Preview" to inspect.`);
      }
    };
    reader.readAsText(file);
  };

  // Perform bulk import to Supabase
  const handleExecuteImport = async () => {
    if (!parsedItems || parsedItems.length === 0) return;
    if (!canManage || !companyId) {
      toast.error("Only cost managers can import features into a company workspace.");
      return;
    }
    setIsImporting(true);
    try {
      const { error } = await supabase.from("scope_features").upsert(parsedItems);
      if (error) throw error;

      await logActivity(companyId, "created", "scope_feature", null, {
        count: parsedItems.length,
        source: "json_import",
      });
      await queryClient.invalidateQueries({ queryKey: ["scope-features"] });
      toast.success(`Imported ${parsedItems.length} features into your library.`);
      setJsonText("");
      setParsedItems(null);
      setShowTransfer(false);
    } catch (err: any) {
      console.error("Import failed:", err);
      toast.error(`Import failed: ${err.message || "Database error"}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Delete a feature
  const handleDeleteFeature = async (id: string, label: string) => {
    if (!canManage || !companyId) {
      toast.error("Only cost managers can delete company features.");
      return;
    }
    if (!confirm(`Are you sure you want to delete "${label}" from your library?`)) return;
    try {
      const { error } = await supabase
        .from("scope_features")
        .delete()
        .eq("id", id)
        .eq("company_id", companyId);
      if (error) throw error;
      await logActivity(companyId, "deleted", "scope_feature", id, { name: label });
      await queryClient.invalidateQueries({ queryKey: ["scope-features"] });
      toast.success(`Deleted feature "${label}"`);
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  const handleEditFeature = (feature: ScopeFeatureRecord) => {
    if (!canManage || !feature.is_custom) return;
    const mediumEffort = feature.effort?.medium ?? createManualForm();
    setEditingFeature(feature);
    setManualForm({
      label: feature.label,
      category: feature.category as FeatureCategory,
      description: feature.description ?? "",
      tags: (feature.tags ?? []).join(", "),
      designer: Number(mediumEffort.designer) || 0,
      frontend: Number(mediumEffort.frontend) || 0,
      backend: Number(mediumEffort.backend) || 0,
      mobile: Number(mediumEffort.mobile) || 0,
      pm: Number(mediumEffort.pm) || 0,
      qa: Number(mediumEffort.qa) || 0,
    });
    setShowAddForm(true);
  };

  // Manual Add Form Submit
  const handleSaveManualFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !companyId) {
      toast.error("Only cost managers can change the feature library.");
      return;
    }
    if (!manualForm.label.trim()) {
      toast.error("Please provide a feature label.");
      return;
    }
    setIsSavingManual(true);
    try {
      const baseEffort: FeatureEffort = {
        designer: Number(manualForm.designer) || 0,
        frontend: Number(manualForm.frontend) || 0,
        backend: Number(manualForm.backend) || 0,
        mobile: Number(manualForm.mobile) || 0,
        pm: Number(manualForm.pm) || 0,
        qa: Number(manualForm.qa) || 0,
      };

      const effortObj: Record<Complexity, FeatureEffort> = {
        low: {
          designer: Math.round(baseEffort.designer * 0.5),
          frontend: Math.round(baseEffort.frontend * 0.5),
          backend: Math.round(baseEffort.backend * 0.5),
          mobile: Math.round(baseEffort.mobile * 0.5),
          pm: Math.round(baseEffort.pm * 0.5),
          qa: Math.round(baseEffort.qa * 0.5),
        },
        medium: baseEffort,
        high: {
          designer: Math.round(baseEffort.designer * 2),
          frontend: Math.round(baseEffort.frontend * 2),
          backend: Math.round(baseEffort.backend * 2),
          mobile: Math.round(baseEffort.mobile * 2),
          pm: Math.round(baseEffort.pm * 2),
          qa: Math.round(baseEffort.qa * 2),
        },
      };

      const tags = manualForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const record: Partial<ScopeFeatureRecord> = {
        id:
          editingFeature?.id ??
          `feat-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        company_id: companyId,
        category: manualForm.category,
        label: manualForm.label.trim(),
        description: manualForm.description.trim(),
        effort: effortObj,
        tags,
        sort_order: 999,
        is_custom: true,
      };

      const { error } = editingFeature
        ? await supabase
            .from("scope_features")
            .update({
              category: record.category,
              label: record.label,
              description: record.description,
              effort: record.effort,
              icon: record.icon,
              tags: record.tags,
              sort_order: record.sort_order,
            })
            .eq("id", editingFeature.id)
            .eq("company_id", companyId)
        : await supabase.from("scope_features").insert(record);
      if (error) throw error;

      await logActivity(
        companyId,
        editingFeature ? "updated" : "created",
        "scope_feature",
        record.id,
        { name: record.label },
      );
      await queryClient.invalidateQueries({ queryKey: ["scope-features"] });
      toast.success(
        editingFeature
          ? `Feature "${manualForm.label}" updated in the library!`
          : `Feature "${manualForm.label}" saved to library!`,
      );
      setShowAddForm(false);
      setEditingFeature(null);
      setManualForm(createManualForm());
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setIsSavingManual(false);
    }
  };

  // Export all features as formatted JSON
  const csvRows = useMemo(() => featuresToCsvRows(features), [features]);

  const exportJsonContent = useMemo(() => {
    const clean = features.map((f) => ({
      category: f.category,
      label: f.label,
      description: f.description,
      icon: f.icon,
      tags: f.tags,
      effort: f.effort,
    }));
    return JSON.stringify(clean, null, 2);
  }, [features]);

  const handleCopyExport = useCallback(() => {
    navigator.clipboard.writeText(exportJsonContent);
    setCopiedExport(true);
    toast.success("Export JSON copied to clipboard!");
    setTimeout(() => setCopiedExport(false), 2000);
  }, [exportJsonContent]);

  const handleDownloadExport = useCallback(() => {
    const blob = new Blob([exportJsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `costcraft-feature-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Feature library exported as JSON!");
  }, [exportJsonContent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b via-card to-background">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="font-display font-bold text-xl flex items-center gap-2">
                <BookOpen className="size-5 text-foreground" />
                <span>Software Scope Blueprint Library</span>
                <Badge variant="outline" className="text-xs bg-muted text-foreground border-border">
                  {stats.total} Features
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Add, update or delete custom blueprints, and import or export the library as JSON.
              </DialogDescription>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground font-mono">
                {stats.standard} Standard
              </span>
              <span className="px-2.5 py-1 rounded-md bg-muted text-foreground dark:text-muted-foreground font-mono font-semibold">
                {stats.custom} Custom
              </span>
            </div>
          </div>
        </div>

        {/* Everything on one page — browse, edit and archive without switching tabs */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <section
            aria-label="Browse and edit features"
            className="flex flex-col min-h-0 p-5 gap-4"
          >
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  aria-label="Search features"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search features by name, description, tags..."
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  aria-label="Filter features"
                  value={filterCustomOnly}
                  onChange={(e) => setFilterCustomOnly(e.target.value as any)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All Features ({stats.total})</option>
                  <option value="custom">Custom Only ({stats.custom})</option>
                  <option value="standard">Standard Only ({stats.standard})</option>
                </select>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs font-semibold"
                  onClick={() =>
                    downloadCsv("scope-features.csv", csvRows, [...FEATURE_CSV_COLUMNS])
                  }
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  CSV
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs font-semibold"
                  aria-expanded={showTransfer}
                  onClick={() => setShowTransfer((v) => !v)}
                >
                  <Upload className="size-3.5" aria-hidden="true" />
                  Import / Export
                </Button>

                <Button
                  size="sm"
                  onClick={() => {
                    setEditingFeature(null);
                    setManualForm(createManualForm());
                    setShowAddForm(true);
                  }}
                  disabled={!canManage || !companyId}
                  title={!canManage ? "Only cost managers can add features" : undefined}
                  className="h-8 gap-1.5 text-xs font-semibold"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add Feature
                </Button>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex gap-1 overflow-x-auto pb-1 text-xs no-scrollbar">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setSelectedCategory(c.key)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 border transition-colors cursor-pointer ${
                    selectedCategory === c.key
                      ? "bg-primary text-white border-border shadow-xs"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Features List */}
            <ScrollArea className="flex-1 rounded-lg border bg-card p-3">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Loading feature library...
                </div>
              ) : filteredFeatures.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-sm font-semibold text-muted-foreground">
                    No features matched your filters
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Try adjusting your search or category filter.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredFeatures.map((f) => {
                    const mediumEffort = f.effort?.medium || {};
                    const totalHours =
                      (mediumEffort.designer || 0) +
                      (mediumEffort.frontend || 0) +
                      (mediumEffort.backend || 0) +
                      (mediumEffort.mobile || 0) +
                      (mediumEffort.pm || 0) +
                      (mediumEffort.qa || 0);

                    return (
                      <div
                        key={f.id}
                        className="rounded-lg border p-3 hover:border-border dark:hover:border-border transition-all bg-background/50 flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <CategoryGlyph category={f.category} />
                              <h4 className="font-display font-semibold text-xs leading-tight">
                                {f.label}
                              </h4>
                            </div>
                            {f.is_custom ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-4 bg-muted text-foreground font-bold"
                              >
                                Custom
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4 text-muted-foreground font-mono"
                              >
                                Standard
                              </Badge>
                            )}
                          </div>
                          {f.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
                              {f.description}
                            </p>
                          )}
                        </div>

                        {/* Effort Chips */}
                        <div className="flex items-center justify-between pt-2 border-t text-[10px] text-muted-foreground">
                          <div className="flex flex-wrap gap-1">
                            {mediumEffort.designer ? (
                              <span className="bg-muted px-1.5 py-0.5 rounded font-mono">
                                {mediumEffort.designer}h
                              </span>
                            ) : null}
                            {mediumEffort.frontend ? (
                              <span className="bg-muted px-1.5 py-0.5 rounded font-mono">
                                {mediumEffort.frontend}h
                              </span>
                            ) : null}
                            {mediumEffort.backend ? (
                              <span className="bg-muted px-1.5 py-0.5 rounded font-mono">
                                {mediumEffort.backend}h
                              </span>
                            ) : null}
                            {mediumEffort.mobile ? (
                              <span className="bg-muted px-1.5 py-0.5 rounded font-mono">
                                {mediumEffort.mobile}h
                              </span>
                            ) : null}
                            {mediumEffort.qa ? (
                              <span className="bg-muted px-1.5 py-0.5 rounded font-mono">
                                {mediumEffort.qa}h
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-foreground font-mono">
                              {totalHours}h avg
                            </span>
                            {f.is_custom && (
                              <>
                                <button
                                  onClick={() => handleEditFeature(f)}
                                  disabled={!canManage || !companyId}
                                  className="p-1 text-foreground hover:bg-muted rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                                  title="Edit custom feature"
                                >
                                  <Pencil className="size-3" />
                                  <span className="sr-only">Edit {f.label}</span>
                                </button>
                                <button
                                  onClick={() => void handleDeleteFeature(f.id, f.label)}
                                  disabled={!canManage || !companyId}
                                  className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                                  title="Delete custom feature"
                                >
                                  <Trash2 className="size-3" />
                                  <span className="sr-only">Delete {f.label}</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </section>

          <section
            aria-label="Import features"
            hidden={!showTransfer}
            className="flex flex-col min-h-0 border-t p-5 gap-4"
          >
            {/* Format Instructions & Actions */}
            <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileCode2 className="size-4 text-foreground" />
                  <span className="text-xs font-bold text-foreground">
                    JSON Schema & Format Specification
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyTemplate}
                    className="h-7 text-xs gap-1"
                  >
                    {copiedTemplate ? (
                      <Check className="size-3 text-foreground" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span>{copiedTemplate ? "Copied!" : "Copy Template JSON"}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadTemplate}
                    className="h-7 text-xs gap-1"
                  >
                    <Download className="size-3" />
                    <span>Download template.json</span>
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Provide an array of feature objects. You can provide simple shorthand effort (e.g.{" "}
                <code>effort: &#123; designer: 4, frontend: 16, backend: 8 &#125;</code>) or full
                3-tier complexity (<code>low</code>, <code>medium</code>, <code>high</code>). The
                app will automatically compute all complexity tiers and sync them to your MySQL
                database.
              </p>
            </div>

            {/* Input & Editor */}
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>Paste Features JSON or upload a file:</span>
                <label className="cursor-pointer text-foreground hover:text-foreground font-semibold flex items-center gap-1">
                  <Upload className="size-3" />
                  <span>Choose .json file</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <Textarea
                aria-label="Features JSON to import"
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setParsedItems(null);
                  setValidationErrors([]);
                }}
                placeholder={SAMPLE_TEMPLATE_JSON}
                className="flex-1 font-mono text-xs p-3 leading-relaxed resize-none border-border"
              />
            </div>

            {/* Validation Feedback & Action Buttons */}
            <div className="space-y-2">
              {validationErrors.length > 0 && (
                <div className="p-3 rounded-lg border border-destructive bg-destructive/10 text-xs text-destructive dark:text-destructive space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="size-4" />
                    <span>Validation Errors ({validationErrors.length})</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {parsedItems && parsedItems.length > 0 && (
                <div className="p-3 rounded-lg border border-border bg-muted text-xs text-foreground dark:text-muted-foreground flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4" />
                    <span className="font-semibold">
                      Validated {parsedItems.length} features ready for import!
                    </span>
                  </div>
                  <span className="text-[11px] font-mono">
                    Categories: {Array.from(new Set(parsedItems.map((p) => p.category))).join(", ")}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleValidateJson}
                  className="gap-1.5"
                >
                  <Sparkles className="size-3.5 text-foreground" />
                  <span>Validate & Preview JSON</span>
                </Button>

                <Button
                  size="sm"
                  disabled={
                    !canManage ||
                    !companyId ||
                    !parsedItems ||
                    parsedItems.length === 0 ||
                    isImporting
                  }
                  onClick={handleExecuteImport}
                  title={!canManage ? "Only cost managers can import features" : undefined}
                  className="gap-1.5 bg-primary hover:bg-primary text-white font-semibold"
                >
                  <Upload className="size-3.5" />
                  <span>
                    {isImporting
                      ? "Importing..."
                      : `Import ${parsedItems?.length ?? 0} Features to Database`}
                  </span>
                </Button>
              </div>
            </div>
          </section>

          <section
            aria-label="Export features"
            hidden={!showTransfer}
            className="flex flex-col min-h-0 border-t p-5 gap-4"
          >
            <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <Download className="size-4 text-foreground" />
                <span className="text-xs font-bold text-foreground">Export Library as JSON</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Download or copy your complete feature catalog as a structured JSON file. You can
                use this for backups, versioning, or sharing feature libraries with other team
                workspaces.
              </p>
            </div>

            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>Exported JSON Payload ({dbFeatures.length} features):</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyExport}
                    className="h-7 text-xs gap-1"
                  >
                    {copiedExport ? (
                      <Check className="size-3 text-foreground" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    <span>{copiedExport ? "Copied!" : "Copy to Clipboard"}</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDownloadExport}
                    className="h-7 text-xs gap-1 bg-primary hover:bg-primary text-white"
                  >
                    <Download className="size-3" />
                    <span>Download JSON File</span>
                  </Button>
                </div>
              </div>

              <Textarea
                readOnly
                aria-label="Exported features JSON"
                value={exportJsonContent}
                className="flex-1 font-mono text-xs p-3 leading-relaxed resize-none border-border bg-muted/20"
              />
            </div>
          </section>
        </div>

        {/* Modal: Manual Add Single Feature */}
        {showAddForm && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl shadow-xl max-w-lg w-full p-5 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b">
                <h3 className="font-display font-bold text-base flex items-center gap-2">
                  {editingFeature ? (
                    <Pencil className="size-4 text-foreground" />
                  ) : (
                    <Plus className="size-4 text-foreground" />
                  )}
                  <span>{editingFeature ? "Edit Custom Feature" : "Add Feature to Library"}</span>
                </h3>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingFeature(null);
                  }}
                  className="text-muted-foreground hover:text-foreground text-xs"
                ></button>
              </div>

              <form onSubmit={handleSaveManualFeature} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-medium">Feature Label *</label>
                    <Input
                      aria-label="Feature Label"
                      value={manualForm.label}
                      onChange={(e) => setManualForm({ ...manualForm, label: e.target.value })}
                      placeholder="e.g. Stripe Checkout Gateway"
                      className="h-8 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Category</label>
                    <select
                      aria-label="Category"
                      value={manualForm.category}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, category: e.target.value as any })
                      }
                      className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs"
                    >
                      {CATEGORIES.filter((c) => c.key !== "all").map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Tags (comma separated)</label>
                    <Input
                      aria-label="Tags (comma separated)"
                      value={manualForm.tags}
                      onChange={(e) => setManualForm({ ...manualForm, tags: e.target.value })}
                      placeholder="billing, stripe, webhook"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Description</label>
                  <Textarea
                    aria-label="Description"
                    value={manualForm.description}
                    onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                    placeholder="Brief description of requirements and scope..."
                    className="h-16 text-xs"
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-bold text-foreground">
                    Standard Effort Hours (Medium Tier)
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px]">Designer (h)</span>
                      <Input
                        aria-label="Designer (h)"
                        type="number"
                        value={manualForm.designer}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, designer: Number(e.target.value) })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Frontend (h)</span>
                      <Input
                        aria-label="Frontend (h)"
                        type="number"
                        value={manualForm.frontend}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, frontend: Number(e.target.value) })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Backend (h)</span>
                      <Input
                        aria-label="Backend (h)"
                        type="number"
                        value={manualForm.backend}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, backend: Number(e.target.value) })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">Mobile (h)</span>
                      <Input
                        aria-label="Mobile (h)"
                        type="number"
                        value={manualForm.mobile}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, mobile: Number(e.target.value) })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">PM (h)</span>
                      <Input
                        aria-label="PM (h)"
                        type="number"
                        value={manualForm.pm}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, pm: Number(e.target.value) })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px]">QA (h)</span>
                      <Input
                        aria-label="QA (h)"
                        type="number"
                        value={manualForm.qa}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, qa: Number(e.target.value) })
                        }
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingFeature(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSavingManual}
                    className="bg-primary hover:bg-primary text-white font-semibold"
                  >
                    {isSavingManual
                      ? editingFeature
                        ? "Updating..."
                        : "Saving..."
                      : editingFeature
                        ? "Update Feature"
                        : "Save Feature to Library"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
