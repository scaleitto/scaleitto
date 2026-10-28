// Landing page sections. Plain components shared by the public page and the editor preview.
import type { ReactNode } from "react";
import { ArrowLeft, BadgeCheck, Check, ChevronDown, ImageIcon, LoaderCircle, ShoppingBag, Star } from "lucide-react";
import type { StoreText } from "@/i18n/store";
import { Countdown } from "./Countdown";
import { youtubeEmbed, type LandingSection } from "./types";
import { benefitIcons } from "./icons";

const card = "rounded-[var(--s-radius)] border border-s-card-border bg-s-surface shadow-[var(--s-shadow)]";
const h2 = "text-2xl font-extrabold leading-snug sm:text-3xl";

function OrderButton({ label }: { label: string }) {
  return (
    <a href="#order-form" className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--s-radius-btn)] bg-brand px-8 py-4 text-lg font-extrabold text-brand-fg shadow-lg shadow-brand/30 transition hover:brightness-110 sm:w-auto">
      <ShoppingBag size={20} /> {label}
    </a>
  );
}

// Photos keep their own shape (never cropped), on the theme's surface
function Photo({ src, alt = "", className = "" }: { src: string; alt?: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`mx-auto h-auto max-h-[80vh] w-full object-contain ${className}`} />;
}

// The band of selling points at the top of image pages (doubled for a seamless loop)
function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items, ...items];
  return (
    <div className="overflow-hidden bg-brand py-2.5 text-sm font-bold text-brand-fg" data-section="marquee">
      <div className="marquee-track flex w-max gap-8">
        {[...row, ...row].map((item, i) => (
          <span key={i} className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            {item} <ArrowLeft size={14} className="ltr:rotate-180" />
          </span>
        ))}
      </div>
    </div>
  );
}

// A designed marketing image (text inside it). Without its image yet: nothing on the public page,
// a placeholder in the editor.
function Poster({ section, editing, first }: { section: Extract<LandingSection, { type: "poster" }>; editing: boolean; first?: boolean }) {
  if (section.image) {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={section.image}
        alt={[section.headline, section.subtitle].filter(Boolean).join(" — ")}
        width={1024}
        height={1536}
        // The first image is what visitors see first: load it right away, the others when scrolled to
        loading={first ? "eager" : "lazy"}
        fetchPriority={first ? "high" : undefined}
        className="block h-auto w-full"
      />
    );
    // On the public page every image is a way to the order form (an image's text often invites to order)
    return (
      <figure data-section="poster" data-kind={section.kind}>
        {editing ? img : <a href="#order-form" className="block outline-none focus-visible:ring-4 focus-visible:ring-brand/40">{img}</a>}
      </figure>
    );
  }
  if (!editing) return null;
  return (
    <div className="flex aspect-[2/3] flex-col items-center justify-center gap-3 bg-gradient-to-b from-brand/80 to-brand p-8 text-center text-white" data-section="poster" data-pending>
      {section.scene ? <LoaderCircle size={30} className="animate-spin opacity-80" /> : <ImageIcon size={30} className="opacity-80" />}
      <p className="text-2xl leading-snug font-extrabold">{section.headline}</p>
      {section.subtitle && <p className="text-sm opacity-90">{section.subtitle}</p>}
    </div>
  );
}

function Section({ section, t, price, flip = false, editing = false }: { section: LandingSection; t: StoreText; price?: ReactNode; flip?: boolean; editing?: boolean }) {
  const l = t.landing;
  switch (section.type) {
    case "poster":
      return <Poster section={section} editing={editing} />;
    case "marquee":
      return <Marquee items={section.items} />;
    case "hero":
      return (
        <section className="grid items-center gap-5 md:grid-cols-2 md:gap-8" data-section="hero">
          {section.image && (
            <div className={`overflow-hidden ${card}`}>
              <Photo src={section.image} />
            </div>
          )}
          <div className={`space-y-4 text-center md:text-start ${section.image ? "" : "md:col-span-2 md:text-center"}`}>
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
              <BadgeCheck size={18} className="shrink-0 text-brand-ink" /> {item}
            </li>
          ))}
        </ul>
      );
    case "imageText":
      return (
        <section className="grid items-center gap-5 md:grid-cols-2 md:gap-10" data-section="imageText">
          {section.image && (
            <div className={`overflow-hidden ${card} ${flip ? "md:order-2" : ""}`}>
              <Photo src={section.image} />
            </div>
          )}
          <div className={`space-y-3 ${section.image ? "" : "mx-auto max-w-3xl text-center md:col-span-2"}`}>
            {section.title && <h2 className={h2}>{section.title}</h2>}
            {section.body && <p className="text-lg leading-relaxed whitespace-pre-line text-s-muted">{section.body}</p>}
          </div>
        </section>
      );
    case "benefits":
      return (
        <section className="space-y-5" data-section="benefits">
          {section.title && <h2 className={`${h2} text-center`}>{section.title}</h2>}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => (
              <li key={item.title} className={`flex gap-4 p-5 ${card}`}>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand/10 text-2xl text-brand-ink" aria-hidden>
                  <BenefitIcon name={item.icon} />
                </span>
                <span className="space-y-1">
                  <span className="block font-bold">{item.title}</span>
                  {item.text && <span className="block text-sm leading-relaxed text-s-muted">{item.text}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
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
          <div className={`overflow-hidden ${card}`}>
            <Photo src={section.url} alt={section.caption ?? ""} />
          </div>
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
              <img key={src} src={src} alt="" loading="lazy" className={`aspect-square w-full object-contain p-1 ${card}`} />
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
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg">
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
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand font-extrabold text-brand-fg">{i + 1}</span>
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
        <section className="space-y-3 rounded-[var(--s-radius)] bg-brand p-6 text-center text-brand-fg" data-section="countdown">
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

// A benefit card's icon: an SVG from the curated set, or the emoji of an older page
export function BenefitIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = benefitIcons[name];
  return Icon ? <Icon size={size} strokeWidth={2} /> : <>{name}</>;
}

export const isImagePage = (sections: LandingSection[]) => sections.some((s) => s.type === "poster" && !s.hidden);

// The whole page: visible sections in order, with the order form where the "form" section is
// (or right after the hero when there is none).
export function LandingSections({ sections, form, t, price, editing = false }: { sections: LandingSection[]; form: ReactNode; t: StoreText; price?: ReactNode; editing?: boolean }) {
  const visible = sections.filter((s) => !s.hidden);
  // Image pages (Wibi style): one narrow column of full-width images, like a phone screen on every device
  if (visible.some((s) => s.type === "poster")) {
    const formAt = visible.findIndex((s) => s.type === "form");
    const firstPoster = visible.find((s) => s.type === "poster" && s.image)?.id;
    const items = visible.map((s) =>
      s.type === "form" ? (
        <div key={s.id} className="scroll-mt-4 bg-s-surface p-4" data-section="form">
          {form}
        </div>
      ) : s.type === "poster" || s.type === "marquee" || s.type === "image" ? (
        s.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={s.id} src={s.url} alt={s.caption ?? ""} loading="lazy" className="block h-auto w-full" data-section="image" />
        ) : s.type === "poster" ? (
          <Poster key={s.id} section={s} editing={editing} first={s.id === firstPoster} />
        ) : (
          <Section key={s.id} section={s} t={t} editing={editing} />
        )
      ) : (
        <div key={s.id} className="p-4">
          <Section section={s} t={t} price={s.type === "hero" ? price : undefined} editing={editing} />
        </div>
      ),
    );
    // No form section: after the images (the last step of the persuasion sequence)
    if (formAt < 0) {
      items.push((
        <div key="form-slot" className="scroll-mt-4 bg-s-surface p-4" data-section="form">
          {form}
        </div>
      ));
    }
    return (
      <div className="mx-auto w-full max-w-[520px] overflow-hidden sm:rounded-[var(--s-radius)] sm:shadow-[var(--s-shadow)]" data-layout="images">
        {items}
      </div>
    );
  }
  const formAt = visible.findIndex((s) => s.type === "form");
  const insertAt = formAt >= 0 ? formAt : visible.findIndex((s) => s.type === "hero") + 1;
  const out: ReactNode[] = [];
  let imageTexts = 0;
  visible.forEach((s, i) => {
    if (i === insertAt && formAt < 0) out.push(<FormSlot key="form-slot">{form}</FormSlot>);
    // Image + text blocks alternate sides on large screens
    const flip = s.type === "imageText" && imageTexts++ % 2 === 1;
    out.push(s.type === "form" ? <FormSlot key={s.id}>{form}</FormSlot> : <Section key={s.id} section={s} t={t} price={s.type === "hero" ? price : undefined} flip={flip} />);
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
