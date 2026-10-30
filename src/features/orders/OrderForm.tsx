"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Bot,
  Copy,
  House,
  Package,
  Plus,
  Store,
  Trash2,
  X,
} from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt, formatPrice } from "@/lib/format";
import { orderStatuses } from "@/server/db/schema";
import {
  Alert,
  Button,
  Field,
  Input,
  Select,
  Textarea,
  buttonClass,
  inputClass,
} from "@/ui";
import {
  FormMessage,
  SubmitButton,
  fieldError,
  useActionForm,
} from "@/ui/form";
import { CommuneSelect } from "@/features/checkout/CommuneSelect";
import { shippingPrice, type RateMap } from "@/features/checkout/pricing";
import { saveOrder, setPhoneBlocked } from "./actions";
import type { OrderProduct } from "./queries";
import type { OrderStatus } from "./statuses";

type Text = Pick<Dictionary, "orderPage" | "orders" | "errors" | "common">;
type Line = {
  key: number;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
};
export type EditableOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  items: {
    productId: string | null;
    variantId: string | null;
    quantity: number;
    unitPrice: number;
    name: string;
  }[];
  customerName: string;
  phone: string;
  wilayaCode: number;
  commune: string;
  address: string | null;
  deliveryType: "home" | "office";
  carrierAccountId: string | null;
  shippingWaived: boolean;
  shippingPrice: number;
  total: number;
  note: string | null;
  assignedTo: string | null;
  ip: string | null;
  phoneBlocked: boolean;
  // The automatic assignment's last decision
  assignment: { name: string | null; at: string } | null;
};

let keys = 0;

// The order dialog (Zimam's): products on one side, the customer and the delivery on the other, then the status and
// the automatic assignment. The same form creates a manual order (order = null) and edits one.
export function OrderForm({
  lang,
  order,
  products,
  rates,
  wilayas,
  accounts,
  members,
  trackingUrl,
  onDone,
  t,
}: {
  lang: string;
  order: EditableOrder | null;
  products: OrderProduct[];
  rates: RateMap;
  wilayas: { code: number; name: string }[];
  accounts: { id: string; name: string }[];
  // Who the order can be given to (owners and managers); empty for agents
  members: { userId: string; name: string }[];
  trackingUrl: string | null;
  onDone?: () => void;
  t: Text;
}) {
  const p = t.orderPage;
  const errors = t.errors as Record<string, string>;
  const cur = t.common.currency;
  const router = useRouter();
  const { state, pending, onSubmit } = useActionForm(
    saveOrder.bind(null, lang, order?.id ?? null),
  );
  const [lines, setLines] = useState<Line[]>(() =>
    (order?.items ?? [])
      .filter((i) => i.productId)
      .map((i) => ({
        key: ++keys,
        productId: i.productId!,
        variantId: i.variantId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
  );
  const [pick, setPick] = useState("");
  const [wilaya, setWilaya] = useState<number | null>(
    order?.wilayaCode || null,
  );
  const [type, setType] = useState<"home" | "office">(
    order?.deliveryType ?? "home",
  );
  const [waived, setWaived] = useState(order?.shippingWaived ?? false);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  // The fee from the store's delivery prices (the server computes it again); an order whose wilaya has no price keeps its own
  const rated = wilaya ? shippingPrice(rates, wilaya, type) : null;
  const fee = waived
    ? 0
    : (rated ??
      (order && wilaya === order.wilayaCode && type === order.deliveryType
        ? order.shippingPrice
        : 0));
  const [manualTotal, setManualTotal] = useState<string | null>(
    order &&
      order.total !==
        order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) +
          order.shippingPrice
      ? String(order.total)
      : null,
  );
  const total = manualTotal ?? String(subtotal + fee);
  const pieces = lines.reduce((s, l) => s + l.quantity, 0);

  // Saved: a new order opens the list again; an edit stays on its page with fresh data
  const done = useRef(state);
  useEffect(() => {
    if (state === done.current || !state.ok) return;
    done.current = state;
    if (onDone) onDone();
    router.refresh();
  }, [state, onDone, router]);

  const product = (id: string) => products.find((x) => x.id === id);
  const addLine = () => {
    const pr = product(pick);
    if (!pr) return;
    const v = pr.variants[0];
    setLines((ls) => [
      ...ls,
      {
        key: ++keys,
        productId: pr.id,
        variantId: v?.id ?? null,
        quantity: 1,
        unitPrice: v?.price ?? pr.price,
      },
    ]);
    setPick("");
  };
  const patch = (key: number, change: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...change } : l)));
  const err = (f: string) => fieldError(state, errors, f);

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5"
      data-testid="order-form"
      noValidate
    >
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          lines.map(({ productId, variantId, quantity, unitPrice }) => ({
            productId,
            variantId,
            quantity,
            unitPrice,
          })),
        )}
      />
      <input type="hidden" name="total" value={manualTotal ?? ""} />
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Products */}
        <section className="space-y-4 rounded-xl border border-line p-4">
          <h3 className="font-semibold">
            {order ? p.orderProducts : p.productDetails}
          </h3>
          <ul className="space-y-2" data-testid="order-lines">
            {lines.map((l) => {
              const pr = product(l.productId);
              return (
                <li
                  key={l.key}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-panel-2 p-2"
                  data-line={pr?.name}
                >
                  {pr?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pr.image}
                      alt=""
                      className="size-10 rounded-md object-cover"
                    />
                  ) : (
                    <span className="grid size-10 place-items-center rounded-md bg-panel text-muted">
                      <Package size={16} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {pr?.name ??
                        order?.items.find((i) => i.productId === l.productId)
                          ?.name}
                    </p>
                    {pr && pr.variants.length > 0 && (
                      <select
                        value={l.variantId ?? ""}
                        aria-label={p.variant}
                        className="mt-1 max-w-full rounded-md border border-line bg-panel px-2 py-1 text-xs"
                        onChange={(e) => {
                          const v = pr.variants.find(
                            (x) => x.id === e.target.value,
                          );
                          patch(l.key, {
                            variantId: v?.id ?? null,
                            unitPrice: v?.price ?? pr.price,
                          });
                        }}
                      >
                        {pr.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={l.quantity}
                    aria-label={p.quantity}
                    className="w-16 rounded-md border border-line bg-panel px-2 py-1.5 text-sm tabular-nums"
                    data-testid="line-qty"
                    onChange={(e) =>
                      patch(l.key, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    value={l.unitPrice}
                    aria-label={p.price}
                    className="w-24 rounded-md border border-line bg-panel px-2 py-1.5 text-sm tabular-nums"
                    onChange={(e) =>
                      patch(l.key, {
                        unitPrice: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                  <button
                    type="button"
                    aria-label={p.remove}
                    className="grid size-8 place-items-center rounded-md text-muted hover:bg-danger-soft hover:text-danger"
                    onClick={() =>
                      setLines((ls) => ls.filter((x) => x.key !== l.key))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <Select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              aria-label={p.chooseProduct}
              data-testid="pick-product"
            >
              <option value="">{p.chooseProduct}</option>
              {products.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} — {formatPrice(x.price, cur)}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              disabled={!pick}
              onClick={addLine}
              data-testid="add-product"
              className="shrink-0"
            >
              <Plus size={15} /> {p.addProduct}
            </Button>
          </div>
          {err("items") && (
            <p className="text-xs text-danger">{err("items")}</p>
          )}
          <dl className="grid grid-cols-3 gap-3 border-t border-line pt-3 text-sm">
            <div>
              <dt className="text-xs text-muted">{p.quantity}</dt>
              <dd className="font-semibold tabular-nums">{pieces}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{p.productsTotal}</dt>
              <dd className="font-semibold tabular-nums">
                {formatPrice(subtotal, cur)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{p.total}</dt>
              <dd>
                <input
                  value={total}
                  inputMode="numeric"
                  aria-label={p.total}
                  className="w-full rounded-md border border-line bg-panel px-2 py-1 font-bold tabular-nums"
                  data-testid="order-total-input"
                  onChange={(e) =>
                    setManualTotal(e.target.value.replace(/[^\d]/g, ""))
                  }
                />
              </dd>
            </div>
          </dl>
          {members.length > 0 && (
            <Field label={p.agent} htmlFor="agent">
              <Select
                id="agent"
                name="agent"
                defaultValue={order?.assignedTo ?? ""}
              >
                <option value="">{p.notAssigned}</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={p.noteLabel} htmlFor="note">
            <Textarea
              id="note"
              name="note"
              rows={2}
              defaultValue={order?.note ?? ""}
              placeholder={p.notePlaceholder}
            />
          </Field>
          {order && (
            <IpRow
              lang={lang}
              ip={order.ip}
              phone={order.phone}
              blocked={order.phoneBlocked}
              t={t}
            />
          )}
          {trackingUrl && (
            <CopyRow label={p.trackingLink} value={trackingUrl} t={t} />
          )}
        </section>

        {/* Customer and delivery */}
        <section className="space-y-4 rounded-xl border border-line p-4">
          <h3 className="font-semibold">
            {order ? p.personal : p.customerDetails}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={p.fullName}
              htmlFor="customerName"
              error={err("customerName")}
            >
              <Input
                id="customerName"
                name="customerName"
                defaultValue={order?.customerName}
                required
              />
            </Field>
            <Field
              label={p.phone}
              htmlFor="phone"
              hint={p.phoneFormat}
              error={err("phone")}
            >
              <Input
                id="phone"
                name="phone"
                dir="ltr"
                inputMode="tel"
                defaultValue={order?.phone}
                placeholder="05XXXXXXXX"
                required
              />
            </Field>
          </div>
          {order && <h3 className="pt-1 font-semibold">{p.deliveryInfo}</h3>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={p.wilaya}
              htmlFor="wilayaCode"
              error={err("wilayaCode")}
            >
              <Select
                id="wilayaCode"
                name="wilayaCode"
                value={wilaya ?? ""}
                onChange={(e) => setWilaya(Number(e.target.value) || null)}
              >
                <option value="">{p.chooseWilaya}</option>
                {wilayas.map((w) => (
                  <option key={w.code} value={w.code}>
                    {String(w.code).padStart(2, "0")} - {w.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={p.commune} htmlFor="commune" error={err("commune")}>
              <CommuneSelect
                key={wilaya ?? 0}
                wilaya={wilaya}
                arabic={lang === "ar"}
                defaultValue={wilaya === order?.wilayaCode ? order.commune : ""}
                className={inputClass}
                placeholder={p.commune}
                choose={p.chooseCommune}
                chooseWilayaFirst={p.wilayaFirst}
              />
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              {order ? p.deliveryType : p.method}
            </legend>
            <input type="hidden" name="deliveryType" value={type} />
            <div className="grid grid-cols-2 gap-2">
              {(["home", "office"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={type === k}
                  data-delivery={k}
                  onClick={() => setType(k)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-colors ${type === k ? "border-accent bg-accent-soft text-accent-ink" : "border-line hover:bg-panel-2"}`}
                >
                  {k === "home" ? <House size={16} /> : <Store size={16} />}{" "}
                  {k === "home" ? p.homeDelivery : p.deskPickup}
                </button>
              ))}
            </div>
          </fieldset>
          {type === "home" && (
            <Field label={p.addressLabel} htmlFor="address">
              <Input
                id="address"
                name="address"
                defaultValue={order?.address ?? ""}
              />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={p.company} htmlFor="carrierAccountId">
              <Select
                id="carrierAccountId"
                name="carrierAccountId"
                defaultValue={order?.carrierAccountId ?? ""}
              >
                <option value="">{p.none}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={p.fee} htmlFor="fee" hint={p.feeHint}>
              <Input
                id="fee"
                value={fee}
                readOnly
                className="tabular-nums"
                data-testid="order-fee"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="shippingWaived"
              checked={waived}
              onChange={(e) => setWaived(e.target.checked)}
              className="size-4 accent-[var(--color-accent)]"
            />
            {p.feeWaived}
          </label>
          {order && (
            <Field label={p.orderStatus} htmlFor="status">
              <Select id="status" name="status" defaultValue={order.status}>
                {orderStatuses.map((s) => (
                  <option key={s} value={s}>
                    {t.orders.statuses[s]}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </section>
      </div>

      {order && (
        <div
          className="flex items-start gap-3 rounded-xl border border-line bg-panel-2 p-4 text-sm"
          data-testid="auto-assign"
        >
          <Bot size={18} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="font-semibold">{p.autoAssign}</p>
            <p className="text-muted">
              {order.assignment?.name
                ? fmt(p.assignedTo, { name: order.assignment.name })
                : p.noAgent}
              {!order.assignment?.name && (
                <span className="block text-xs">{p.noAgentHint}</span>
              )}
            </p>
            {order.assignment && (
              <p className="text-xs text-muted">
                {fmt(p.decided, { at: order.assignment.at })}
              </p>
            )}
          </div>
        </div>
      )}

      <FormMessage
        state={state}
        errors={errors}
        success={order ? t.common.saved : undefined}
      />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        {onDone && (
          <Button type="button" variant="secondary" onClick={onDone}>
            {p.cancel}
          </Button>
        )}
        <SubmitButton pending={pending} data-testid="save-order">
          {order ? p.save : p.create}
        </SubmitButton>
      </div>
    </form>
  );
}

function IpRow({
  lang,
  ip,
  phone,
  blocked,
  t,
}: {
  lang: string;
  ip: string | null;
  phone: string;
  blocked: boolean;
  t: Text;
}) {
  const p = t.orderPage;
  const [isBlocked, setBlocked] = useState(blocked);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-panel-2 px-3 py-2 text-sm">
      <span>
        <span className="block text-xs text-muted">{p.ip}</span>
        <span dir="ltr" className="tabular-nums">
          {ip ?? "—"}
        </span>
      </span>
      <button
        type="button"
        disabled={pending || !phone}
        data-testid="block-customer"
        className={buttonClass(
          isBlocked ? "secondary" : "danger",
          "px-3 py-1.5 text-xs",
        )}
        onClick={() =>
          start(async () => {
            const r = await setPhoneBlocked(lang, phone, !isBlocked);
            if (r.ok) setBlocked(!isBlocked);
          })
        }
      >
        {isBlocked ? <X size={14} /> : <Ban size={14} />}{" "}
        {isBlocked ? p.unblockCustomer : p.blockCustomer}
      </button>
    </div>
  );
}

function CopyRow({
  label,
  value,
  t,
}: {
  label: string;
  value: string;
  t: Text;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted">{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          dir="ltr"
          className={`${inputClass} text-xs`}
          data-testid="tracking-link"
        />
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            setCopied(true);
          }}
        >
          <Copy size={14} /> {copied ? t.orderPage.copied : t.orderPage.copy}
        </Button>
      </div>
    </div>
  );
}

// "New order": the same form in a dialog over the list
export function NewOrderButton(
  props: Omit<
    Parameters<typeof OrderForm>[0],
    "order" | "onDone" | "trackingUrl"
  >,
) {
  const p = props.t.orderPage;
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(0);
  return (
    <>
      <Button
        type="button"
        onClick={() => (setOpen((n) => n + 1), ref.current?.showModal())}
        data-testid="new-order"
      >
        <Plus size={16} /> {p.newOrder}
      </Button>
      <dialog
        ref={ref}
        className="m-auto w-[min(1000px,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-0 text-fg shadow-xl backdrop:bg-black/40"
        data-testid="new-order-dialog"
      >
        <div className="flex items-start justify-between border-b border-line p-5">
          <div>
            <h2 className="text-lg font-bold">{p.newTitle}</h2>
            <p className="text-sm text-muted">{p.newHint}</p>
          </div>
          <button
            type="button"
            aria-label={p.cancel}
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2"
            onClick={() => ref.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">
          {open > 0 && (
            <OrderForm
              key={open}
              {...props}
              order={null}
              trackingUrl={null}
              onDone={() => ref.current?.close()}
            />
          )}
        </div>
      </dialog>
    </>
  );
}

export function LockedNotice({
  text,
  upgrade,
  href,
}: {
  text: string;
  upgrade: string;
  href: string;
}) {
  return (
    <div data-testid="order-locked">
      <Alert>
        {text}{" "}
        <a href={href} className="font-semibold underline">
          {upgrade}
        </a>
      </Alert>
    </div>
  );
}
