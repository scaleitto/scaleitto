// The page strategy the AI reports, held to the 11-angle rule (pure: unit-tested). The prompt side is strategy.ts.
import { ANGLES_OPTIONAL, ANGLES_REQUIRED, landingAngles, type AnglePlan, type LandingAngle } from "@/lib/enums";
import type { PageStrategy } from "@/server/db/schema";

export type RawStrategy = { audience?: string; angles?: { key?: string; required?: boolean; name?: string; why?: string }[] } | null | undefined;

const isAngle = (v: unknown): v is LandingAngle => landingAngles.includes(v as LandingAngle);

// The model's strategy, trimmed and held to the angle rule (null when absent): only the 11 keys, each once;
// manual = exactly the merchant's angles (a missing one is listed without a reason); auto = 5 required + at most 2 optional
export function cleanStrategy(raw: RawStrategy, custom: boolean, plan: AnglePlan = { mode: "auto" }): PageStrategy | null {
  const seen = new Set<LandingAngle>();
  const given = (raw?.angles ?? []).flatMap((a) => {
    const key = isAngle(a?.key) ? a.key : null;
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [{ key, required: a?.required !== false, name: String(a?.name ?? "").trim().slice(0, 120), why: String(a?.why ?? "").trim().slice(0, 400) }];
  });
  let angles: { key: LandingAngle; required: boolean; name: string; why: string }[];
  if (plan.mode === "manual") {
    angles = plan.keys.map((key) => ({ ...(given.find((a) => a.key === key) ?? { key, name: "", why: "" }), required: true }));
  } else {
    // The model's required ones first; when it marked fewer than 5, its next angles are promoted
    const ordered = [...given.filter((a) => a.required), ...given.filter((a) => !a.required)];
    angles = ordered.slice(0, ANGLES_REQUIRED + ANGLES_OPTIONAL).map((a, i) => ({ ...a, required: i < ANGLES_REQUIRED }));
  }
  const audience = String(raw?.audience ?? "").trim().slice(0, 400);
  return angles.length || audience ? { audience, angles, custom, mode: plan.mode } : null;
}
