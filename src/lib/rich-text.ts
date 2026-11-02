// Product descriptions as rich text (Zimam's editor): a small allowlist of formatting tags. Pure and shared by the
// browser (editor), the server (saving) and the storefront (showing), so whatever is shown went through `cleanRichText`.

const BLOCK = new Set(["p", "h2", "h3", "ul", "ol", "li", "blockquote", "div"]);
const INLINE = new Set(["strong", "b", "em", "i", "u", "s", "strike", "a", "span", "br"]);
// Their content is dropped with them
const DROP = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math", "head", "title"]);
const ALIGN = /text-align\s*:\s*(left|right|center|justify|start|end)/i;
const RENAME: Record<string, string> = { b: "strong", i: "em", strike: "s", div: "p" };

const escapeText = (s: string) => s.replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function attr(raw: string, name: string) {
  const m = raw.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}

function safeHref(href: string) {
  const v = href.trim().replace(/&amp;/g, "&");
  return /^(https?:\/\/|mailto:|tel:)/i.test(v) ? v : null;
}

// Keeps only the editor's formatting: paragraphs, headings 2–3, lists, quotes, bold / italic / underline / strike,
// links (http, mailto, tel; opened in a new tab) and text alignment. Everything else is dropped, its text kept.
export function cleanRichText(html: string): string {
  const out: string[] = [];
  const stack: string[] = [];
  let skip = 0;
  const tokens = html.replace(/<!--[\s\S]*?-->/g, "").split(/(<\/?[a-zA-Z][^>]*>)/);
  const hasBlock = () => stack.some((x) => BLOCK.has(x));
  // Text or inline formatting outside any block goes into a paragraph
  const ensureBlock = () => {
    if (!hasBlock()) {
      stack.push("p");
      out.push("<p>");
    }
  };
  for (const token of tokens) {
    const tag = token.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>$/);
    if (!tag) {
      if (!skip && token) {
        if (token.trim()) ensureBlock();
        out.push(escapeText(token));
      }
      continue;
    }
    const [, closing, rawName, rest] = tag;
    const name = rawName.toLowerCase();
    if (DROP.has(name)) {
      if (closing) skip = Math.max(0, skip - 1);
      else if (!/\/\s*$/.test(rest)) skip++;
      continue;
    }
    if (skip || (!BLOCK.has(name) && !INLINE.has(name))) continue;
    const el = RENAME[name] ?? name;
    if (el === "br") {
      if (!closing) {
        ensureBlock();
        out.push("<br>");
      }
      continue;
    }
    if (closing) {
      const at = stack.lastIndexOf(el);
      if (at === -1) continue;
      while (stack.length > at) out.push(`</${stack.pop()}>`);
      continue;
    }
    // A paragraph, heading, list or quote never sits inside a paragraph or heading: close those first
    if (BLOCK.has(el) && el !== "li") {
      const at = stack.findIndex((x) => x === "p" || x === "h2" || x === "h3");
      if (at !== -1) while (stack.length > at) out.push(`</${stack.pop()}>`);
    }
    if (!BLOCK.has(el)) ensureBlock();
    let attrs = "";
    if (el === "a") {
      const href = safeHref(attr(rest, "href") ?? "");
      if (!href) continue;
      attrs = ` href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow"`;
    } else if (BLOCK.has(el)) {
      const align = (attr(rest, "style") ?? "").match(ALIGN)?.[1] ?? attr(rest, "align");
      if (align && /^(left|right|center|justify|start|end)$/i.test(align)) attrs = ` style="text-align:${align.toLowerCase()}"`;
    }
    if (el === "span" && !attrs) {
      stack.push("span");
      out.push("<span>");
      continue;
    }
    stack.push(el);
    out.push(`<${el}${attrs}>`);
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  // Spans carry nothing we keep: unwrap them; drop empty paragraphs at the ends
  return out
    .join("")
    .replace(/<\/?span>/g, "")
    .replace(/^(?:<p>(?:\s|<br>)*<\/p>)+|(?:<p>(?:\s|<br>)*<\/p>)+$/g, "")
    .trim();
}

export const isRichText = (s: string) => /<\/?(p|br|strong|b|em|i|u|s|h2|h3|ul|ol|li|blockquote|a|div)\b/i.test(s);

// An older plain-text description (or the AI's text) as rich text: blank lines split paragraphs, "• " / "- " lines
// become a list
export function richTextFromPlain(text: string): string {
  const blocks = text.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return blocks
    .filter((b) => b.trim())
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const bullets = lines.filter((l) => /^[•\-*]\s+/.test(l));
      if (bullets.length && bullets.length === lines.length) return `<ul>${bullets.map((l) => `<li>${escapeText(l.replace(/^[•\-*]\s+/, ""))}</li>`).join("")}</ul>`;
      // Mixed: plain lines first, then the list
      if (bullets.length) {
        const plain = lines.filter((l) => !/^[•\-*]\s+/.test(l));
        return `<p>${plain.map(escapeText).join("<br>")}</p><ul>${bullets.map((l) => `<li>${escapeText(l.replace(/^[•\-*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p>${lines.map(escapeText).join("<br>")}</p>`;
    })
    .join("");
}

// What the storefront shows: clean rich text, or a plain description turned into paragraphs
export const descriptionHtml = (s: string | null | undefined) => (!s ? "" : isRichText(s) ? cleanRichText(s) : richTextFromPlain(s));

// The words only (word counts, AI notes, search snippets)
export function richTextToPlain(html: string): string {
  return html
    .replace(/<\/(p|h2|h3|li|blockquote|div)>|<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
