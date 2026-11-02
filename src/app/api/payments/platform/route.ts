import { NextResponse } from "next/server";
import { logError } from "@/server/errors";
import { chargily } from "@/features/payments/providers";
import { approveCreditPurchase, platformChargily } from "@/features/credits/purchases";

// Chargily calls this when a credit pack bought by card is paid (signed with the platform's secret key)
export async function POST(request: Request) {
  const raw = await request.text();
  try {
    const gateway = platformChargily();
    if (!gateway || !chargily.verify(raw, request.headers.get("signature"), gateway.keys)) return NextResponse.json({ ok: false }, { status: 403 });
    const event = JSON.parse(raw) as { type?: string; data?: { metadata?: { order_id?: unknown } } };
    const id = event.data?.metadata?.order_id;
    if (event.type === "checkout.paid" && typeof id === "string") await approveCreditPurchase(id, null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    await logError("credits/webhook", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
