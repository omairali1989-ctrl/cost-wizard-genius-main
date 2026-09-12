import * as React from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  skills: string;
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

export const EmployeeDialog = React.memo(function EmployeeDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  onSave,
}: EmployeeDialogProps) {
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
          <Field label="Skills" hint="Comma separated">
            <Input
              placeholder="React, Node.js, AWS"
              value={form.skills}
              onChange={(e) => setForm((prev) => ({ ...prev, skills: e.target.value }))}
            />
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
