import type { ZodError } from "zod";

// Zod issues → { field: "messageKey" } using the first problem of each field.
// Schemas use messages like "e:price"; anything else becomes "invalid".
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!out[field]) out[field] = issue.message.startsWith("e:") ? issue.message.slice(2) : "invalid";
  }
  return out;
}
