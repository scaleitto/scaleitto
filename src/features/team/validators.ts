import { z } from "zod";
import { isValidTime } from "./schedule";

export const newMemberSchema = z.object({
  name: z.string().trim().min(2, "e:tooShort").max(120, "e:invalid"),
  email: z.string().trim().toLowerCase().email("e:email").max(191, "e:email"),
  role: z.enum(["manager", "agent"], { error: "e:invalid" }),
  password: z.string().min(8, "e:password").max(200, "e:password"),
});

// Role, status and schedule of a member. Days come from checkboxes named "days".
export function parseMemberUpdate(formData: FormData) {
  return z
    .object({
      role: z.enum(["manager", "agent"], { error: "e:invalid" }),
      hasSchedule: z.preprocess((v) => v === "on", z.boolean()),
      days: z.array(z.coerce.number().int().min(0).max(6)),
      start: z.string(),
      end: z.string(),
    })
    .superRefine((d, ctx) => {
      if (!d.hasSchedule) return;
      if (!d.days.length) ctx.addIssue({ code: "custom", path: ["days"], message: "e:scheduleDays" });
      if (!isValidTime(d.start)) ctx.addIssue({ code: "custom", path: ["start"], message: "e:invalid" });
      if (!isValidTime(d.end) || d.end === d.start) ctx.addIssue({ code: "custom", path: ["end"], message: "e:invalid" });
    })
    .transform((d) => ({ role: d.role, schedule: d.hasSchedule ? { days: [...new Set(d.days)].sort(), start: d.start, end: d.end } : null }))
    .safeParse({
      role: formData.get("role"),
      hasSchedule: formData.get("hasSchedule"),
      days: formData.getAll("days"),
      start: String(formData.get("start") ?? ""),
      end: String(formData.get("end") ?? ""),
    });
}
