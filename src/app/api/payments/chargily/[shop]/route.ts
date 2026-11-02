import { NextResponse } from "next/server";
import { logError } from "@/server/errors";
import { chargily } from "@/features/payments/providers";
import { markPaid, paymentAccounts } from "@/features/payments/flow";

// Chargily Pay calls this when a checkout is paid (or fails). It is believed only when the signature matches the
// merchant's own secret key.
export async function POST(request: Request, { params }: { params: Promise<{ shop: string }> }) {
  const { shop } = await params;
  if (!/^[0-9a-f-]{36}$/.test(shop)) return NextResponse.json({ ok: false }, { status: 404 });
  const raw = await request.text();
  try {
    const account = (await paymentAccounts(shop)).find((a) => a.provider === "chargily");
    if (!account || !chargily.verify(raw, request.headers.get("signature"), account.keys)) return NextResponse.json({ ok: false }, { status: 403 });
    const event = JSON.parse(raw) as { type?: string; data?: { metadata?: { order_id?: unknown } } };
    const orderId = event.data?.metadata?.order_id;
    if (event.type === "checkout.paid" && typeof orderId === "string") await markPaid(shop, orderId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    await logError("payments/chargily-webhook", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
