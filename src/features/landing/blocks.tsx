// Landing page sections. Plain components shared by the public page and the editor preview.
import type { ReactNode } from "react";
import { BadgeCheck, Check, ChevronDown, ShoppingBag, Star } from "lucide-react";
import type { StoreText } from "@/i18n/store";
import { Countdown } from "./Countdown";
import { youtubeEmbed, type LandingSection } from "./types";

const card = "rounded-[var(--s-radius)] border border-s-card-border bg-s-surface shadow-[var(--s-shadow)]";
const h2 = "text-2xl font-extrabold leading-snug sm:text-3xl";

function OrderButton({ label }: { label: string }) {
  return (
    <a href="#order-form" className="inline-flex items-center justify-center gap-2 rounded-[var(--s-radius-btn)] bg-brand px-8 py-4 text-lg font-extrabold text-white shadow-lg shadow-brand/30 transition hover:brightness-110">
      <ShoppingBag size={20} /> {label}
    </a>
  );
}

function Section({ section, t, price }: { section: LandingSection; t: StoreText; price?: ReactNode }) {
  const l = t.landing;
  switch (section.type) {
    case "hero":
      return (
        <section className="grid items-center gap-6 md:grid-cols-2" data-section="hero">
          {section.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={section.image} alt="" className={`aspect-square w-full object-cover ${card}`} />
          )}
          <div className={`space-y-4 ${section.image ? "" : "text-center md:col-span-2"}`}>
            {section.badge && <span className="inline-block rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">{section.badge}</span>}
            <h1 className="text-3xl leading-tight font-extrabold sm:text-4xl">{section.title}</h1>
            {section.subtitle && <p className="text-lg text-s-muted">{section.subtitle}</p>}
            {price}
            <OrderButton label={l.orderNow} />
          </div>
        </section>
      );
    case "badges":
      return (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-section="badges">
          {section.items.map((item) => (
            <li key={item} className={`flex items-center gap-2 p-3 text-sm font-semibold ${card}`}>
              <BadgeCheck size={18} className="shrink-0 text-brand" /> {item}
            </li>
          ))}
        </ul>
      );
    case "text":
      return (
        <section className="mx-auto max-w-3xl space-y-3 text-center" data-section="text">
          {section.title && <h2 className={h2}>{section.title}</h2>}
          <p className="text-lg leading-relaxed whitespace-pre-line text-s-muted">{section.body}</p>
        </section>
      );
    case "image":
      return (
        <figure className="mx-auto max-w-3xl" data-section="image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={section.url} alt={section.caption ?? ""} className={`w-full object-cover ${card}`} />
          {section.caption && <figcaption className="mt-2 text-center text-sm text-s-muted">{section.caption}</figcaption>}
        </figure>
      );
    case "gallery":
      return (
        <section className="space-y-4" data-section="gallery">
          {section.title && <h2 className={`${h2} text-center`}>{section.title}</h2>}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {section.images.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className={`aspect-square w-full object-cover ${card}`} />
            ))}
          </div>
        </section>
      );
    case "features":
      return (
        <section className={`space-y-5 p-6 sm:p-8 ${card}`} data-section="features">
          <h2 className={`${h2} text-center`}>{section.title || l.features}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {section.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-base">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                  <Check size={14} strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      );
    case "steps":
      return (
        <section className="space-y-5" data-section="steps">
          <h2 className={`${h2} text-center`}>{section.title || l.steps}</h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {section.items.map((item, i) => (
              <li key={item} className={`flex items-start gap-3 p-4 ${card}`}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand font-extrabold text-white">{i + 1}</span>
                <span className="pt-1 font-semibold">{item}</span>
              </li>
            ))}
          </ol>
        </section>
      );
    case "faq":
      return (
        <section className="mx-auto max-w-3xl space-y-4" data-section="faq">
          <h2 className={`${h2} text-center`}>{section.title || l.faq}</h2>
          <div className="space-y-2">
            {section.items.map((item) => (
              <details key={item.q} className={`group p-4 ${card}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
                  {item.q}
                  <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 leading-relaxed whitespace-pre-line text-s-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
    case "reviews":
      return (
        <section className="space-y-4" data-section="reviews">
          <h2 className={`${h2} text-center`}>{section.title || l.reviews}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((r) => (
              <li key={r.name + r.text} className={`space-y-2 p-4 ${card}`}>
                <div className="flex gap-0.5 text-amber-400" aria-label={`${r.rating}/5`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={16} fill={i < r.rating ? "currentColor" : "none"} />
                  ))}
                </div>
                <p className="leading-relaxed">{r.text}</p>
                <p className="text-sm font-bold text-s-muted">{r.name}</p>
              </li>
            ))}
          </ul>
        </section>
      );
    case "video": {
      const src = youtubeEmbed(section.url);
      return src ? (
        <div className={`mx-auto aspect-video max-w-3xl overflow-hidden ${card}`} data-section="video">
          <iframe src={src} title="video" className="size-full" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
        </div>
      ) : null;
    }
    case "countdown":
      return (
        <section className="space-y-3 rounded-[var(--s-radius)] bg-brand p-6 text-center text-white" data-section="countdown">
          <p className="text-lg font-bold">{section.title || l.countdown}</p>
          <Countdown endsAt={section.endsAt} t={l} />
        </section>
      );
    case "cta":
      return (
        <section className="space-y-4 rounded-[var(--s-radius)] bg-brand/10 p-8 text-center" data-section="cta">
          <h2 className={h2}>{section.title}</h2>
          {section.subtitle && <p className="text-lg text-s-muted">{section.subtitle}</p>}
          <OrderButton label={l.orderNow} />
        </section>
      );
    default:
      return null;
  }
}

// The whole page: visible sections in order, with the order form where the "form" section is
// (or right after the hero when there is none).
export function LandingSections({ sections, form, t, price }: { sections: LandingSection[]; form: ReactNode; t: StoreText; price?: ReactNode }) {
  const visible = sections.filter((s) => !s.hidden);
  const formAt = visible.findIndex((s) => s.type === "form");
  const insertAt = formAt >= 0 ? formAt : visible.findIndex((s) => s.type === "hero") + 1;
  const out: ReactNode[] = [];
  visible.forEach((s, i) => {
    if (i === insertAt && formAt < 0) out.push(<FormSlot key="form-slot">{form}</FormSlot>);
    out.push(s.type === "form" ? <FormSlot key={s.id}>{form}</FormSlot> : <Section key={s.id} section={s} t={t} price={s.type === "hero" ? price : undefined} />);
  });
  if (insertAt >= visible.length && formAt < 0) out.push(<FormSlot key="form-slot">{form}</FormSlot>);
  return <div className="space-y-10 sm:space-y-14">{out}</div>;
}

function FormSlot({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl scroll-mt-20" data-section="form">
      {children}
    </div>
  );
}
