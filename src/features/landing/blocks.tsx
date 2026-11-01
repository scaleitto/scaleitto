// The landing page's components (Zimam's builder): plain components shared by the public page and the editor
// preview. Pages are one phone-width column; images reach its edges.
import type { CSSProperties, ReactNode } from "react";
import { Banknote, Check, ChevronDown, Clock, ImageIcon, PartyPopper, Phone, RefreshCw, ShieldCheck, ShoppingBag, Star, Truck, type LucideIcon } from "lucide-react";
import type { StoreText } from "@/i18n/store";
import { Countdown } from "./Countdown";
import { youtubeEmbed, type BadgeIcon, type LandingSection } from "./types";

const card = "rounded-[var(--s-radius)] border border-s-card-border bg-s-surface shadow-[var(--s-shadow)]";
const h2 = "text-xl font-extrabold leading-snug";

export const badgeIconOf: Record<BadgeIcon, LucideIcon> = { truck: Truck, banknote: Banknote, phone: Phone, shield: ShieldCheck, refresh: RefreshCw, clock: Clock, star: Star, check: Check };

export type BlockLabels = { placeholder: string; thankYou: string; emptyText: string; emptyReviews: string; emptyFaq: string; emptyBadges: string; emptyBullets: string; emptyVideo: string };
type Labels = BlockLabels;

function ImageBlock({ s, editing, first, labels }: { s: Extract<LandingSection, { type: "image" }>; editing: boolean; first: boolean; labels?: Labels }) {
  const frame: CSSProperties = {
    marginBlock: s.margin || undefined,
    borderWidth: s.borderWidth || undefined,
    borderStyle: s.borderWidth ? "solid" : undefined,
    borderColor: s.borderWidth ? s.borderColor || "var(--color-s-edge)" : undefined,
    borderRadius: s.radius || undefined,
  };
  if (!s.url) {
    if (!editing) return null;
    return (
      <div style={frame} className="flex aspect-[4/5] flex-col items-center justify-center gap-2 overflow-hidden bg-black/5 text-s-muted" data-section="image" data-empty>
        <ImageIcon size={30} aria-hidden />
        <span className="text-sm italic">{s.poster?.headline || labels?.placeholder}</span>
      </div>
    );
  }
  const fit = s.fit === "cover" ? "aspect-[4/5] w-full object-cover" : s.fit === "contain" ? "aspect-square w-full object-contain" : "h-auto w-full";
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={s.url}
      alt={s.poster ? [s.poster.headline, s.poster.subtitle].filter(Boolean).join(" — ") : ""}
      // The first image is what visitors see first: load it right away, the others when scrolled to
      loading={first ? "eager" : "lazy"}
      fetchPriority={first ? "high" : undefined}
      className={`block ${fit}`}
    />
  );
  return (
    <figure style={frame} className="overflow-hidden" data-section="image">
      {/* On the public page every image is a way to the order form */}
      {editing ? img : <a href="#order-form" className="block outline-none focus-visible:ring-4 focus-visible:ring-brand/40">{img}</a>}
    </figure>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-[var(--s-radius)] border border-dashed border-s-edge p-4 text-center text-sm text-s-muted">{text}</p>;
}

export function OrderButton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <a href="#order-form" className={`flex w-full items-center justify-center gap-2 rounded-[var(--s-radius-btn)] bg-brand px-6 py-3.5 text-lg font-extrabold text-brand-fg shadow-lg shadow-brand/30 transition hover:brightness-110 ${className}`} data-testid="sticky-order">
      <ShoppingBag size={20} /> {label}
    </a>
  );
}

function Block({ s, t, editing, first, labels }: { s: LandingSection; t: StoreText; editing: boolean; first: boolean; labels?: Labels }) {
  const l = t.landing;
  switch (s.type) {
    case "image":
      return <ImageBlock s={s} editing={editing} first={first} labels={labels} />;
    case "text": {
      if (!s.title && !s.body) return editing ? <div className="p-4"><Empty text={labels?.emptyText ?? ""} /></div> : null;
      const size = s.size === "sm" ? "text-sm" : s.size === "lg" ? "text-lg" : "text-base";
      return (
        <section className={`space-y-2 px-4 py-3 ${s.align === "center" ? "text-center" : "text-start"}`} data-section="text">
          {s.title && <h2 className={h2}>{s.title}</h2>}
          {s.body && <p className={`leading-relaxed whitespace-pre-line text-s-muted ${size}`}>{s.body}</p>}
        </section>
      );
    }
    case "form":
      return null;
    case "sticky":
      // The real button is fixed at the bottom of the screen (LandingSections); the builder shows where it is
      return editing ? (
        <div className="p-3" data-section="sticky">
          <OrderButton label={s.label || l.orderNow} />
        </div>
      ) : null;
    case "thankYou":
      return editing ? (
        <div className={`m-4 space-y-1 p-4 text-center ${card}`} data-section="thankYou">
          <PartyPopper size={22} className="mx-auto text-brand-ink" aria-hidden />
          <p className="text-xs font-semibold text-s-muted uppercase">{labels?.thankYou}</p>
          <p className="font-bold">{s.title || t.landing.thanks.title}</p>
          <p className="text-sm text-s-muted">{s.message || t.landing.thanks.message}</p>
        </div>
      ) : null;
    case "countdown":
      return (
        <section className="space-y-2 bg-brand px-4 py-5 text-center text-brand-fg" data-section="countdown">
          <p className="font-bold">{s.title || l.countdown}</p>
          <Countdown endsAt={s.endsAt} t={l} />
        </section>
      );
    case "reviews":
      if (!s.items.length) return editing ? <div className="p-4"><Empty text={labels?.emptyReviews ?? ""} /></div> : null;
      return (
        <section className="space-y-3 px-4 py-4" data-section="reviews">
          <h2 className={`${h2} text-center`}>{s.title || l.reviews}</h2>
          <ul className="space-y-2.5">
            {s.items.map((r, i) => (
              <li key={i} className={`space-y-1.5 p-3.5 ${card}`}>
                <div className="flex gap-0.5 text-amber-400" aria-label={`${r.rating}/5`}>
                  {Array.from({ length: 5 }, (_, n) => (
                    <Star key={n} size={15} fill={n < r.rating ? "currentColor" : "none"} />
                  ))}
                </div>
                <p className="leading-relaxed">{r.text}</p>
                <p className="text-sm font-bold text-s-muted">{r.name}</p>
              </li>
            ))}
          </ul>
        </section>
      );
    case "badges":
      if (!s.items.length) return editing ? <div className="p-4"><Empty text={labels?.emptyBadges ?? ""} /></div> : null;
      return (
        <ul className="grid grid-cols-2 gap-2 px-4 py-3" data-section="badges">
          {s.items.map((b, i) => {
            const Icon = badgeIconOf[b.icon];
            return (
              <li key={i} className={`flex items-center gap-2 p-2.5 text-sm font-semibold ${card}`}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand-ink">
                  <Icon size={17} aria-hidden />
                </span>
                {b.text}
              </li>
            );
          })}
        </ul>
      );
    case "faq":
      if (!s.items.length) return editing ? <div className="p-4"><Empty text={labels?.emptyFaq ?? ""} /></div> : null;
      return (
        <section className="space-y-3 px-4 py-4" data-section="faq">
          <h2 className={`${h2} text-center`}>{s.title || l.faq}</h2>
          <div className="space-y-2">
            {s.items.map((item, i) => (
              <details key={i} className={`group p-3.5 ${card}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                  {item.q}
                  <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" />
                </summary>
                <p className="mt-2 leading-relaxed whitespace-pre-line text-s-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
    case "spacer":
      return (
        <div aria-hidden style={{ height: s.size }} className="flex items-center px-4" data-section="spacer">
          {s.line && <span className="h-px w-full bg-s-edge" />}
        </div>
      );
    case "bullets":
      if (!s.items.length) return editing ? <div className="p-4"><Empty text={labels?.emptyBullets ?? ""} /></div> : null;
      return (
        <section className="space-y-3 px-4 py-4" data-section="bullets">
          {s.title && <h2 className={h2}>{s.title}</h2>}
          <ul className="space-y-2">
            {s.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${s.style === "dot" ? "" : "bg-brand text-brand-fg"} text-xs font-bold`}>
                  {s.style === "number" ? i + 1 : s.style === "dot" ? <span className="size-2 rounded-full bg-brand" /> : <Check size={14} strokeWidth={3} />}
                </span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    case "video": {
      const src = youtubeEmbed(s.url);
      if (!src) return editing ? <div className="p-4"><Empty text={labels?.emptyVideo ?? ""} /></div> : null;
      return (
        <div className="aspect-video w-full" data-section="video">
          {/* In the builder a click selects the block instead of playing the video */}
          <iframe src={src} title="video" className={`size-full ${editing ? "pointer-events-none" : ""}`} allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
        </div>
      );
    }
    case "announcement":
      if (!s.text) return editing ? <p className="bg-brand/40 px-4 py-2.5 text-center text-sm text-brand-fg">…</p> : null;
      return s.scrolling ? (
        <div className="overflow-hidden bg-brand py-2.5 text-sm font-bold text-brand-fg" data-section="announcement">
          <div className="marquee-track flex w-max gap-10">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="shrink-0 whitespace-nowrap">
                {s.text}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="bg-brand px-4 py-2.5 text-center text-sm font-bold text-brand-fg" data-section="announcement">
          {s.text}
        </p>
      );
  }
}

// The whole page: visible components in order, the order form where the "form" component is (at the end when there
// is none), and the sticky order button fixed at the bottom of the screen.
export function LandingSections({
  sections,
  form,
  t,
  editing = false,
  selected = null,
  labels,
  toolbar,
}: {
  sections: LandingSection[];
  form: ReactNode;
  t: StoreText;
  editing?: boolean;
  selected?: string | null;
  labels?: Labels;
  // The builder's small actions on the selected block (duplicate, hide, delete)
  toolbar?: (id: string) => ReactNode;
}) {
  const visible = editing ? sections : sections.filter((s) => !s.hidden);
  const firstImage = visible.find((s) => s.type === "image" && s.url)?.id;
  const sticky = visible.find((s): s is Extract<LandingSection, { type: "sticky" }> => s.type === "sticky");
  const formSlot = (key: string) => (
    <div key={key} id={editing ? undefined : "order-form"} className="scroll-mt-4 bg-s-surface p-4" data-section="form">
      {form}
    </div>
  );
  // In the builder every block carries its id (a click selects it), the selected one is outlined with its toolbar
  const wrap = (s: LandingSection, node: ReactNode) =>
    editing ? (
      <div key={s.id} data-sid={s.id} data-type={s.type} className={`relative cursor-pointer ${s.hidden ? "opacity-40" : ""} ${selected === s.id ? "z-10 outline-2 -outline-offset-2 outline-[#10b981] outline-solid" : "hover:outline-1 hover:-outline-offset-1 hover:outline-[#10b981]/60 hover:outline-dashed"}`}>
        {node}
        {selected === s.id && toolbar?.(s.id)}
      </div>
    ) : (
      node
    );
  const items = visible.map((s) => wrap(s, s.type === "form" ? formSlot(s.id) : <Block key={s.id} s={s} t={t} editing={editing} first={s.id === firstImage} labels={labels} />));
  if (!visible.some((s) => s.type === "form")) items.push(formSlot("form-slot"));
  return (
    <div className="mx-auto w-full max-w-[520px] overflow-hidden bg-s-bg sm:rounded-[var(--s-radius)] sm:shadow-[var(--s-shadow)]" data-layout="landing">
      {items}
      {!editing && sticky && (
        <>
          <div className="h-20" aria-hidden />
          <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3">
            <div className="mx-auto max-w-[496px]">
              <OrderButton label={sticky.label || t.landing.orderNow} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
