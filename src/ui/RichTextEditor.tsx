"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Strikethrough, Underline, Undo2 } from "lucide-react";
import { cleanRichText } from "@/lib/rich-text";

export type RichTextLabels = { bold: string; italic: string; underline: string; strike: string; h2: string; h3: string; bullets: string; numbers: string; quote: string; left: string; center: string; right: string; link: string; linkPrompt: string; undo: string; redo: string };

// Zimam's description editor: a toolbar over an editable area. The value is clean HTML (lib/rich-text) kept in a hidden
// field named `name`, so the form sends it like any other field. `value` set from outside (the AI writer) replaces it.
export function RichTextEditor({ id, name, value, onChange, placeholder, labels, invalid = false }: { id: string; name: string; value: string; onChange: (html: string) => void; placeholder: string; labels: RichTextLabels; invalid?: boolean }) {
  const area = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const [empty, setEmpty] = useState(!value);
  const [active, setActive] = useState<Record<string, boolean>>({});

  // Outside changes (first render, AI text) go into the area; our own typing does not come back
  useEffect(() => {
    const el = area.current;
    if (!el || value === emitted.current) return;
    el.innerHTML = value;
    emitted.current = value;
    setEmpty(!el.textContent?.trim());
  }, [value]);

  const sync = () => {
    const el = area.current;
    if (!el) return;
    const html = el.textContent?.trim() || el.querySelector("li") ? cleanRichText(el.innerHTML) : "";
    emitted.current = html;
    setEmpty(!el.textContent?.trim());
    onChange(html);
  };
  const refreshState = () => {
    const q = (c: string) => {
      try {
        return document.queryCommandState(c);
      } catch {
        return false;
      }
    };
    const block = (() => {
      try {
        return String(document.queryCommandValue("formatBlock")).toLowerCase();
      } catch {
        return "";
      }
    })();
    setActive({ bold: q("bold"), italic: q("italic"), underline: q("underline"), strike: q("strikeThrough"), ul: q("insertUnorderedList"), ol: q("insertOrderedList"), h2: block === "h2", h3: block === "h3", quote: block === "blockquote" });
  };
  const run = (command: string, arg?: string) => {
    area.current?.focus();
    document.execCommand(command, false, arg);
    sync();
    refreshState();
  };
  const toggleBlock = (tag: "h2" | "h3" | "blockquote") => run("formatBlock", active[tag === "blockquote" ? "quote" : tag] ? "p" : tag);
  const link = () => {
    const url = window.prompt(labels.linkPrompt, "https://");
    if (url && /^(https?:\/\/|mailto:|tel:)/i.test(url.trim())) run("createLink", url.trim());
  };

  const tools: (null | { key: string; label: string; icon: ReactNode; onClick: () => void; on?: boolean })[] = [
    { key: "bold", label: labels.bold, icon: <Bold size={16} />, onClick: () => run("bold"), on: active.bold },
    { key: "italic", label: labels.italic, icon: <Italic size={16} />, onClick: () => run("italic"), on: active.italic },
    { key: "underline", label: labels.underline, icon: <Underline size={16} />, onClick: () => run("underline"), on: active.underline },
    { key: "strike", label: labels.strike, icon: <Strikethrough size={16} />, onClick: () => run("strikeThrough"), on: active.strike },
    null,
    { key: "h2", label: labels.h2, icon: <Heading2 size={16} />, onClick: () => toggleBlock("h2"), on: active.h2 },
    { key: "h3", label: labels.h3, icon: <Heading3 size={16} />, onClick: () => toggleBlock("h3"), on: active.h3 },
    null,
    { key: "ul", label: labels.bullets, icon: <List size={16} />, onClick: () => run("insertUnorderedList"), on: active.ul },
    { key: "ol", label: labels.numbers, icon: <ListOrdered size={16} />, onClick: () => run("insertOrderedList"), on: active.ol },
    { key: "quote", label: labels.quote, icon: <Quote size={16} />, onClick: () => toggleBlock("blockquote"), on: active.quote },
    null,
    { key: "left", label: labels.left, icon: <AlignLeft size={16} />, onClick: () => run("justifyLeft") },
    { key: "center", label: labels.center, icon: <AlignCenter size={16} />, onClick: () => run("justifyCenter") },
    { key: "right", label: labels.right, icon: <AlignRight size={16} />, onClick: () => run("justifyRight") },
    null,
    { key: "link", label: labels.link, icon: <Link2 size={16} />, onClick: link },
  ];
  const button = (t: NonNullable<(typeof tools)[number]>) => (
    <button
      key={t.key}
      type="button"
      title={t.label}
      aria-label={t.label}
      aria-pressed={t.on ?? undefined}
      data-tool={t.key}
      // Keep the selection in the text while clicking the toolbar
      onMouseDown={(e) => e.preventDefault()}
      onClick={t.onClick}
      className={`grid size-8 place-items-center rounded-md transition-colors ${t.on ? "bg-accent-soft text-accent" : "text-fg-2 hover:bg-panel-2 hover:text-fg"}`}
    >
      {t.icon}
    </button>
  );

  return (
    <div className={`overflow-hidden rounded-xl border bg-field focus-within:border-accent ${invalid ? "border-danger" : "border-field-line"}`} data-testid="rich-text">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-field-line bg-panel px-2 py-1.5" role="toolbar" dir="ltr">
        {tools.map((t, i) => (t ? button(t) : <span key={`sep${i}`} className="mx-1 h-5 w-px bg-line" aria-hidden />))}
        <span className="ms-auto flex gap-0.5">
          {button({ key: "undo", label: labels.undo, icon: <Undo2 size={16} />, onClick: () => run("undo") })}
          {button({ key: "redo", label: labels.redo, icon: <Redo2 size={16} />, onClick: () => run("redo") })}
        </span>
      </div>
      <div className="relative">
        {empty && <p className="pointer-events-none absolute inset-x-4 top-3 text-sm text-muted">{placeholder}</p>}
        <div
          ref={area}
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          contentEditable
          suppressContentEditableWarning
          dir="auto"
          onInput={sync}
          onKeyUp={refreshState}
          onMouseUp={refreshState}
          onPaste={(e) => {
            // Pasted pages bring their own styles: keep only the words
            e.preventDefault();
            document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
          }}
          className="rich-text min-h-48 px-4 py-3 text-sm leading-relaxed outline-none"
        />
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
