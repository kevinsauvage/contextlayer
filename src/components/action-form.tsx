"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";
import { formString } from "@/lib/form";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  name: string;
  title: string;
  description: string;
  placeholder: string;
  submitLabel: string;
  pendingLabel: string;
  defaultValue?: string;
  multiline?: boolean;
};

export function ActionForm({
  action,
  name,
  title,
  description,
  placeholder,
  submitLabel,
  pendingLabel,
  defaultValue,
  multiline = false,
}: Props) {
  // React resets the form after an action; echoing the value back keeps it for correction after an error.
  const [state, formAction, pending] = useActionState<ActionState & { value?: string }, FormData>(
    async (previous, formData) => ({
      ...(await action(previous, formData)),
      value: formString(formData, name),
    }),
    {},
  );
  const errorId = `${name}-error`;
  const field = {
    id: name,
    name,
    placeholder,
    required: true,
    disabled: pending,
    defaultValue: state.value ?? defaultValue,
    "aria-invalid": Boolean(state.error),
    "aria-describedby": state.error ? errorId : undefined,
  };
  const submitButton = (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : submitLabel}
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <label htmlFor={name}>{title}</label>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-2">
          {multiline ? (
            <>
              <Textarea
                {...field}
                rows={5}
                maxLength={4000}
                className="max-h-96 min-h-28"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
                    event.currentTarget.form?.requestSubmit();
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to submit</span>
                {submitButton}
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <Input {...field} />
              {submitButton}
            </div>
          )}
          {pending && (
            <p className="text-xs text-muted-foreground" role="status">
              Reading the code and related tickets. This usually takes under a minute.
            </p>
          )}
          {state.error && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
