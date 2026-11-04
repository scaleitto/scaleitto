"use client";

// The builder's "Content" tab: the fields of the selected item (a section of the page, or a global part).
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Field, Input, Select, Textarea } from "@/ui";
import { SwitchRow } from "@/ui/Switch";
import { ImageManager } from "@/ui/ImageManager";
import { colorPresets, styleChoices, type StyleOverrides } from "./types";
import { heroVariants, newId, MAX_FAQ, MAX_LINKS, type NavLink, type StoreSection } from "./builder";

export type BuilderText = Pick<Dictionary, "design" | "media" | "errors" | "common" | "settings">;

// The global parts as the builder edits them (sent to saveStoreDesign as they are)
export type GlobalState = {
  primaryColor: string;
  logoUrl: string;
  announcementEnabled: boolean;
  announcementText: string;
  navigationEnabled: boolean;
  links: NavLink[];
  showPhone: boolean;
  footerEnabled: boolean;
  style: StyleOverrides;
  about: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  telegram: string;
  whatsapp: string;
};

export type Targets = { pages: { handle: string; title: string }[]; collections: { handle: string; title: string }[]; policies: { kind: string; title: string }[] };

const fontNames: Record<string, string> = { cairo: "Cairo", tajawal: "Tajawal", almarai: "Almarai", changa: "Changa", "el-messiri": "El Messiri", plex: "IBM Plex", kufi: "Noto Kufi", readex: "Readex" };

type Errors = (field: string) => string | undefined;

function StyleSelect({ k, g, set, t, only }: { k: keyof StyleOverrides; g: GlobalState; set: (p: Partial<GlobalState>, key: string) => void; t: BuilderText; only?: readonly (string | number)[] }) {
  const d = t.design;
  const label = (v: string | number) => (k === "font" ? fontNames[v] : (d.styleOptions as Record<string, string>)[k === "cards" && v === "minimal" ? "minimalCard" : String(v)]);
  const id = `style-${k}`;
  return (
    <Field label={d.styleLabels[k]} htmlFor={id}>
      <Select id={id} value={String(g.style[k] || "")} onChange={(e) => set({ style: { ...g.style, [k]: k === "columns" ? Number(e.target.value) || 0 : e.target.value } }, `style.${k}`)}>
        <option value="">{d.themeDefault}</option>
        {(only ?? styleChoices[k]).map((v) => (
          <option key={v} value={v}>
            {label(v)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

// The theme panel (palette icon): color, logo-free style choices; global, applies at once
export function ThemeFields({ g, set, t, err }: { g: GlobalState; set: (p: Partial<GlobalState>, key: string) => void; t: BuilderText; err: Errors }) {
  const d = t.design;
  const valid = /^#[0-9a-f]{6}$/i.test(g.primaryColor) ? g.primaryColor : "#4f3bd6";
  return (
    <div className="space-y-4">
      <Field label={d.color} htmlFor="primaryColor" hint={d.colorHint} error={err("primaryColor")}>
        <div className="flex flex-wrap items-center gap-2">
          <input type="color" aria-label={d.color} value={valid} onChange={(e) => set({ primaryColor: e.target.value }, "color")} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-bg p-1" />
          <Input id="primaryColor" dir="ltr" className="w-28 font-mono" value={g.primaryColor} maxLength={7} onChange={(e) => set({ primaryColor: e.target.value.trim() }, "color")} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {colorPresets.map((c) => (
            <button key={c} type="button" aria-label={c} onClick={() => set({ primaryColor: c }, "")} className={`size-7 rounded-full border-2 ${g.primaryColor === c ? "border-fg" : "border-transparent"}`} style={{ background: c }} />
          ))}
        </div>
      </Field>
      {(["font", "corners", "cards", "image", "columns", "hero"] as const).map((k) => (
        <StyleSelect key={k} k={k} g={g} set={set} t={t} />
      ))}
    </div>
  );
}

function targetOf(link: NavLink) {
  return link.target.startsWith("url:") ? "url" : link.target;
}

// Header, announcement bar, navigation, footer
export function GlobalFields({ part, g, set, t, err, targets }: { part: "header" | "announcement" | "navigation" | "footer"; g: GlobalState; set: (p: Partial<GlobalState>, key: string) => void; t: BuilderText; err: Errors; targets: Targets }) {
  const d = t.design;
  const f = d.builder.f;
  if (part === "header")
    return (
      <div className="space-y-4">
        <Field label={d.logo} hint={d.logoHint}>
          <ImageManager t={t.media} value={g.logoUrl ? [g.logoUrl] : []} onChange={(v) => set({ logoUrl: v[0] ?? "" }, "")} max={1} />
        </Field>
        <StyleSelect k="header" g={g} set={set} t={t} />
        <SwitchRow label={f.showPhone} checked={g.showPhone} onChange={(v) => set({ showPhone: v }, "")} testId="show-phone" />
      </div>
    );
  if (part === "announcement")
    return (
      <div className="space-y-4">
        <SwitchRow label={f.showAnnouncement} checked={g.announcementEnabled} onChange={(v) => set({ announcementEnabled: v }, "")} testId="announcement-enabled" />
        <Field label={d.builder.announcement} htmlFor="announcementText" error={err("announcementText")}>
          <Input id="announcementText" maxLength={160} placeholder={d.announcementPlaceholder} value={g.announcementText} onChange={(e) => set({ announcementText: e.target.value }, "announcement")} />
        </Field>
      </div>
    );
  if (part === "navigation") {
    const setLink = (i: number, patch: Partial<NavLink>) => set({ links: g.links.map((l, n) => (n === i ? { ...l, ...patch } : l)) }, `link.${i}.${Object.keys(patch)[0]}`);
    const move = (i: number, by: number) => {
      const next = [...g.links];
      const [x] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, x);
      set({ links: next }, "");
    };
    return (
      <div className="space-y-4">
        <SwitchRow label={f.showNavigation} checked={g.navigationEnabled} onChange={(v) => set({ navigationEnabled: v }, "")} testId="navigation-enabled" />
        <p className="text-sm font-semibold">{f.links}</p>
        <p className="text-xs text-muted">{f.linksHint}</p>
        <ul className="space-y-3" data-testid="nav-links">
          {g.links.map((l, i) => (
            <li key={l.id} className="space-y-2 rounded-xl border border-line p-3" data-link={i}>
              <Input aria-label={f.linkLabel} placeholder={f.linkLabel} maxLength={40} value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} data-link-label />
              <Select aria-label={f.linkTarget} value={targetOf(l)} onChange={(e) => setLink(i, { target: e.target.value === "url" ? "url:https://" : e.target.value })} data-link-target>
                <option value="home">{f.targets.home}</option>
                <option value="products">{f.targets.products}</option>
                {targets.pages.map((p) => (
                  <option key={p.handle} value={`page:${p.handle}`}>
                    {f.targets.page}: {p.title}
                  </option>
                ))}
                {targets.collections.map((c) => (
                  <option key={c.handle} value={`collection:${c.handle}`}>
                    {f.targets.collection}: {c.title}
                  </option>
                ))}
                {targets.policies.map((p) => (
                  <option key={p.kind} value={`policy:${p.kind}`}>
                    {f.targets.policy}: {p.title}
                  </option>
                ))}
                <option value="url">{f.targets.url}</option>
              </Select>
              {l.target.startsWith("url:") && <Input dir="ltr" aria-label={f.url} placeholder="https://" value={l.target.slice(4)} onChange={(e) => setLink(i, { target: `url:${e.target.value.trim()}` })} data-link-url />}
              <div className="flex justify-end gap-1 text-muted">
                <button type="button" className="grid size-7 place-items-center rounded hover:bg-panel-2" aria-label={d.builder.moveUp} onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp size={14} />
                </button>
                <button type="button" className="grid size-7 place-items-center rounded hover:bg-panel-2" aria-label={d.builder.moveDown} onClick={() => move(i, 1)} disabled={i === g.links.length - 1}>
                  <ArrowDown size={14} />
                </button>
                <button type="button" className="grid size-7 place-items-center rounded text-danger hover:bg-danger-soft" aria-label={d.builder.remove} onClick={() => set({ links: g.links.filter((_, n) => n !== i) }, "")}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {g.links.length < MAX_LINKS && (
          <button type="button" onClick={() => set({ links: [...g.links, { id: newId("l"), label: "", target: "home" }] }, "")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-sm font-semibold text-muted hover:border-accent hover:text-accent" data-testid="add-link">
            <Plus size={15} /> {f.addLink}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <SwitchRow label={f.showFooter} checked={g.footerEnabled} onChange={(v) => set({ footerEnabled: v }, "")} testId="footer-enabled" />
      <Field label={d.about} htmlFor="about" error={err("about")}>
        <Textarea id="about" rows={3} maxLength={1000} placeholder={d.aboutPlaceholder} value={g.about} onChange={(e) => set({ about: e.target.value }, "about")} />
      </Field>
      <p className="text-sm font-semibold">{d.socials}</p>
      {(["facebook", "instagram", "tiktok", "telegram"] as const).map((k) => (
        <Field key={k} label={k === "tiktok" ? "TikTok" : k[0].toUpperCase() + k.slice(1)} htmlFor={k} error={err(k)}>
          <Input id={k} dir="ltr" placeholder={k === "telegram" ? "https://t.me/…" : `https://${k}.com/…`} value={g[k]} onChange={(e) => set({ [k]: e.target.value }, k)} />
        </Field>
      ))}
      <Field label={d.whatsapp} htmlFor="whatsapp" error={err("whatsapp")}>
        <Input id="whatsapp" dir="ltr" inputMode="tel" placeholder="0555 12 34 56" value={g.whatsapp} onChange={(e) => set({ whatsapp: e.target.value }, "whatsapp")} />
      </Field>
    </div>
  );
}

// One section's fields
export function SectionFields({ s, update, t, collections }: { s: StoreSection; update: (patch: Partial<StoreSection>) => void; t: BuilderText; collections: { id: string; title: string }[] }) {
  const d = t.design;
  const f = d.builder.f;
  const text = (key: string, label: string, max: number, long = false) => {
    const value = (s as unknown as Record<string, string>)[key] ?? "";
    const id = `sec-${key}`;
    return (
      <Field label={label} htmlFor={id}>
        {long ? (
          <Textarea id={id} rows={4} maxLength={max} value={value} onChange={(e) => update({ [key]: e.target.value } as Partial<StoreSection>)} data-field={key} />
        ) : (
          <Input id={id} maxLength={max} value={value} onChange={(e) => update({ [key]: e.target.value } as Partial<StoreSection>)} data-field={key} />
        )}
      </Field>
    );
  };
  const image = (value: string) => (
    <Field label={f.image}>
      <ImageManager t={t.media} value={value ? [value] : []} onChange={(v) => update({ image: v[0] ?? "" } as Partial<StoreSection>)} max={1} />
    </Field>
  );
  switch (s.type) {
    case "hero":
      return (
        <div className="space-y-4">
          {image(s.image)}
          {text("title", f.title, 120)}
          {text("subtitle", f.subtitle, 300, true)}
          {text("buttonText", f.button, 40)}
          <Field label={f.style} htmlFor="sec-variant">
            <Select id="sec-variant" value={s.variant} onChange={(e) => update({ variant: e.target.value as typeof s.variant })}>
              <option value="">{d.themeDefault}</option>
              {heroVariants.map((v) => (
                <option key={v} value={v}>
                  {(d.styleOptions as Record<string, string>)[v]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      );
    case "products":
      return (
        <div className="space-y-4">
          {text("title", f.title, 80)}
          <Field label={f.collection} htmlFor="sec-collection">
            <Select id="sec-collection" value={s.collectionId} onChange={(e) => update({ collectionId: e.target.value })}>
              <option value="">{f.allProducts}</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={f.limit} htmlFor="sec-limit">
            <Select id="sec-limit" value={String(s.limit)} onChange={(e) => update({ limit: Number(e.target.value) })}>
              <option value="0">{f.all}</option>
              {[4, 8, 12, 16, 24].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={f.columns} htmlFor="sec-columns">
            <Select id="sec-columns" value={String(s.columns)} onChange={(e) => update({ columns: Number(e.target.value) as 0 | 2 | 3 | 4 })}>
              <option value="0">{d.themeDefault}</option>
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      );
    case "collections":
      return <div className="space-y-4">{text("title", f.title, 80)}</div>;
    case "text":
      return (
        <div className="space-y-4">
          {text("title", f.title, 120)}
          {text("body", f.body, 2000, true)}
          <Field label={f.align} htmlFor="sec-align">
            <Select id="sec-align" value={s.align} onChange={(e) => update({ align: e.target.value as "start" | "center" })}>
              <option value="center">{f.alignCenter}</option>
              <option value="start">{f.alignStart}</option>
            </Select>
          </Field>
        </div>
      );
    case "imageText":
      return (
        <div className="space-y-4">
          {image(s.image)}
          {text("title", f.title, 120)}
          {text("body", f.body, 1000, true)}
          {text("buttonText", f.button, 40)}
          <Field label={f.buttonLink} htmlFor="sec-buttonHref" hint="/pages/… · https://…">
            <Input id="sec-buttonHref" dir="ltr" maxLength={300} value={s.buttonHref} onChange={(e) => update({ buttonHref: e.target.value })} />
          </Field>
          <Field label={f.side} htmlFor="sec-side">
            <Select id="sec-side" value={s.side} onChange={(e) => update({ side: e.target.value as "start" | "end" })}>
              <option value="start">{f.sideStart}</option>
              <option value="end">{f.sideEnd}</option>
            </Select>
          </Field>
        </div>
      );
    case "faq":
      return (
        <div className="space-y-4">
          {text("title", f.title, 120)}
          {s.items.map((item, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-line p-3" data-faq={i}>
              <Input aria-label={f.question} placeholder={f.question} maxLength={200} value={item.q} onChange={(e) => update({ items: s.items.map((x, n) => (n === i ? { ...x, q: e.target.value } : x)) })} />
              <Textarea aria-label={f.answer} placeholder={f.answer} rows={2} maxLength={1000} value={item.a} onChange={(e) => update({ items: s.items.map((x, n) => (n === i ? { ...x, a: e.target.value } : x)) })} />
              <button type="button" className="flex items-center gap-1 text-xs text-danger" onClick={() => update({ items: s.items.filter((_, n) => n !== i) })}>
                <Trash2 size={13} /> {d.builder.remove}
              </button>
            </div>
          ))}
          {s.items.length < MAX_FAQ && (
            <button type="button" onClick={() => update({ items: [...s.items, { q: "", a: "" }] })} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-sm font-semibold text-muted hover:border-accent hover:text-accent">
              <Plus size={15} /> {f.addQuestion}
            </button>
          )}
        </div>
      );
    case "video":
      return (
        <div className="space-y-4">
          {text("title", f.title, 120)}
          <Field label={f.videoUrl} htmlFor="sec-url">
            <Input id="sec-url" dir="ltr" placeholder="https://www.youtube.com/watch?v=…" value={s.url} onChange={(e) => update({ url: e.target.value.trim() })} />
          </Field>
        </div>
      );
    case "spacer":
      return (
        <Field label={f.size} htmlFor="sec-size">
          <Select id="sec-size" value={s.size} onChange={(e) => update({ size: e.target.value as "sm" | "md" | "lg" })}>
            <option value="sm">{f.small}</option>
            <option value="md">{f.medium}</option>
            <option value="lg">{f.large}</option>
          </Select>
        </Field>
      );
    default:
      return null;
  }
}
