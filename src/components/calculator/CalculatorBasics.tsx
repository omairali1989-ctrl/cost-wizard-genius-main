import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";

interface CalculatorBasicsProps {
  projectName: string;
  clientName: string;
  description: string;
  onChange: (patch: { projectName?: string; clientName?: string; description?: string }) => void;
}

export const CalculatorBasics = React.memo(function CalculatorBasics({
  projectName,
  clientName,
  description,
  onChange,
}: CalculatorBasicsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">1. Project basics</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="Project name">
          <Input
            value={projectName}
            onChange={(e) => onChange({ projectName: e.target.value })}
          />
        </Field>
        <Field label="Client">
          <Input
            value={clientName}
            onChange={(e) => onChange({ clientName: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="What is being built? (optional)">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
});
