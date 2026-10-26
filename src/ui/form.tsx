"use client";

import { useFormStatus } from "react-dom";
import { startTransition, useActionState, type ComponentProps, type FormEvent } from "react";
import { Alert, buttonClass } from "./index";
import { initialActionState, type ActionState } from "@/lib/action";

// Runs a server action from a form without React's automatic reset, so typed values stay after an error.
export function useActionForm(action: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
  const [state, dispatch, pending] = useActionState(action, initialActionState);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return { state, pending, onSubmit };
}

// Submit button that shows a pending state while its form's action runs.
export function SubmitButton({ children, pending: pendingProp, pendingText, variant = "primary", className, ...props }: ComponentProps<"button"> & { pending?: boolean; pendingText?: string; variant?: "primary" | "secondary" | "danger" }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, className)} {...props}>
      {pending ? (pendingText ?? "…") : children}
    </button>
  );
}

// Shows the result of a server action: its error (translated) or success message.
export function FormMessage({ state, errors, success }: { state: ActionState; errors: Record<string, string>; success?: string }) {
  if (state.error) return <Alert>{errors[state.error] ?? errors.unexpected}</Alert>;
  if (state.ok && success) return <Alert variant="success">{success}</Alert>;
  return null;
}

export function fieldError(state: ActionState, errors: Record<string, string>, field: string) {
  const key = state.fieldErrors?.[field];
  return key ? (errors[key] ?? errors.invalid) : undefined;
}
