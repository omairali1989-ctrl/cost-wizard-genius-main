import * as React from "react";
import { Label } from "@/components/ui/label";

export interface FieldProps {
  label: string;
  hint?: string;
  id?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, id, children }: FieldProps) {
  const generatedId = React.useId();
  const controlId = id ?? `field-${generatedId.replace(/:/g, "")}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const child = React.Children.only(children);
  const control = React.isValidElement(child)
    ? React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        id: (child.props as { id?: string }).id ?? controlId,
        "aria-describedby": hintId,
      })
    : children;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={controlId}>{label}</Label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
