import * as React from "react";
import { Plus, X } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_OPTIONS } from "@/lib/currency";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface EmployeeFormData {
  name: string;
  job_title: string;
  department: string;
  seniority: string;
  monthly_salary: number;
  salary_currency: string;
  annual_salary: number;
  employer_cost_pct: number;
  billable_target_pct: number;
  skills: string[];
  active: boolean;
}

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: EmployeeFormData;
  setForm: React.Dispatch<React.SetStateAction<EmployeeFormData>>;
  onSave: (e: React.FormEvent) => void;
}

const COMMON_SKILLS = [
  "React",
  "TypeScript",
  "Node.js",
  "Python",
  "Laravel",
  "PHP",
  "Next.js",
  "Vue",
  "Java",
  "Flutter",
  "React Native",
  "AWS",
  "Azure",
  "GCP",
  "Figma",
  "PostgreSQL",
  "MySQL",
  "Docker",
  "QA",
];

export const EmployeeDialog = React.memo(function EmployeeDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  onSave,
}: EmployeeDialogProps) {
  const [skillDraft, setSkillDraft] = React.useState("");

  React.useEffect(() => {
    if (open) setSkillDraft("");
  }, [open]);

  const addSkill = (rawSkill: string) => {
    const skill = rawSkill.trim().replace(/\s+/g, " ");
    if (!skill) return;
    setForm((prev) => {
      if (prev.skills.some((existing) => existing.toLowerCase() === skill.toLowerCase())) {
        return prev;
      }
      return { ...prev, skills: [...prev.skills, skill] };
    });
    setSkillDraft("");
  };

  const removeSkill = (skillToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove),
    }));
  };

  const handleSkillDraftChange = (value: string) => {
    if (!value.includes(",")) {
      setSkillDraft(value);
      return;
    }
    const parts = value.split(",");
    parts.slice(0, -1).forEach(addSkill);
    setSkillDraft(parts.at(-1) ?? "");
  };

  const availableSuggestions = COMMON_SKILLS.filter(
    (suggestion) => !form.skills.some((skill) => skill.toLowerCase() === suggestion.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Edit person" : "Add person"}
          </DialogTitle>
          <DialogDescription>
            Only salary, employer cost and billable target affect pricing.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-4">
          <Field label="Name">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job title">
              <Input
                value={form.job_title}
                onChange={(e) => setForm((prev) => ({ ...prev, job_title: e.target.value }))}
              />
            </Field>
            <Field label="Department">
              <Input
                value={form.department}
                onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
              />
            </Field>
            <Field label="Seniority">
              <Input
                value={form.seniority}
                onChange={(e) => setForm((prev) => ({ ...prev, seniority: e.target.value }))}
              />
            </Field>
            <Field label="Currency">
              <Select
                value={form.salary_currency}
                onValueChange={(value) => setForm((prev) => ({ ...prev, salary_currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Monthly salary">
              <Input
                type="number"
                min={0}
                value={form.monthly_salary}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, monthly_salary: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="Annual salary" hint="Calculated automatically">
              <Input type="number" value={form.monthly_salary * 12} readOnly aria-readonly="true" />
            </Field>
            <Field label="Employer cost %" hint="Taxes, benefits, insurance">
              <Input
                type="number"
                min={0}
                value={form.employer_cost_pct}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, employer_cost_pct: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="Billable target %" hint="Share of time on client work">
              <Input
                type="number"
                min={1}
                max={100}
                value={form.billable_target_pct}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, billable_target_pct: Number(e.target.value) }))
                }
              />
            </Field>
          </div>
          <Field label="Skills" hint="Select several or type a skill and press Enter">
            <div>
              <div className="rounded-md border bg-background p-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <div className="flex min-h-9 flex-wrap items-center gap-1.5">
                  {form.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                      {skill}
                      <button
                        type="button"
                        aria-label={`Remove ${skill}`}
                        className="rounded-sm p-0.5 hover:bg-muted"
                        onClick={() => removeSkill(skill)}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    className="h-8 min-w-[180px] flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
                    placeholder={form.skills.length ? "Add another skill" : "e.g. React"}
                    value={skillDraft}
                    onChange={(e) => handleSkillDraftChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addSkill(skillDraft);
                      } else if (e.key === "Backspace" && !skillDraft && form.skills.length) {
                        removeSkill(form.skills.at(-1)!);
                      }
                    }}
                    onBlur={() => addSkill(skillDraft)}
                  />
                </div>
              </div>
              {availableSuggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Suggestions</span>
                  {availableSuggestions.slice(0, 8).map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                      onClick={() => addSkill(skill)}
                    >
                      <Plus className="size-3" />
                      {skill}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.active}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, active: v }))}
            />
            <Label>Currently employed</Label>
          </div>
          <DialogFooter>
            <Button type="submit">{editing ? "Save changes" : "Add person"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
