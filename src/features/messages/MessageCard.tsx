"use client";

import { useState } from "react";
import { Copy, MessageCircle, MessageSquareText, Smartphone } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { Card, Select, Textarea } from "@/ui";
import { fillTemplate, messageKinds, smsLink, whatsappLink, type MessageKind, type MessageVars } from "./templates";
import { logMessageSent } from "./actions";

// On the order page: the right message for the situation, filled with the order's details,
// sent from the agent's own phone (WhatsApp or SMS) and kept in the order's history.
export function MessageCard({ lang, orderId, phone, texts, vars, initialKind, t }: { lang: string; orderId: string; phone: string; texts: Record<MessageKind, string>; vars: MessageVars; initialKind: MessageKind; t: Dictionary["assistant"] }) {
  const m = t.messages;
  const [kind, setKind] = useState(initialKind);
  const [text, setText] = useState(() => fillTemplate(texts[initialKind], vars));
  const [copied, setCopied] = useState(false);
  const log = (channel: "whatsapp" | "sms" | "copy") => void logMessageSent(lang, orderId, channel, text).catch(() => {});
  const button = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition";
  return (
    <Card className="space-y-3" data-testid="message-card">
      <div className="flex items-start gap-3">
        <MessageSquareText size={18} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <h2 className="font-semibold">{m.title}</h2>
          <p className="mt-0.5 text-xs text-muted">{m.hint}</p>
        </div>
      </div>
      <Select
        aria-label={m.situation}
        value={kind}
        onChange={(e) => {
          const k = e.target.value as MessageKind;
          setKind(k);
          setText(fillTemplate(texts[k], vars));
          setCopied(false);
        }}
      >
        {messageKinds.map((k) => (
          <option key={k} value={k}>
            {m.kinds[k]}
          </option>
        ))}
      </Select>
      <Textarea aria-label={m.title} rows={6} dir="auto" value={text} onChange={(e) => setText(e.target.value)} data-testid="message-text" />
      <div className="grid grid-cols-3 gap-2">
        <a href={whatsappLink(phone, text)} target="_blank" rel="noreferrer" onClick={() => log("whatsapp")} className={`${button} bg-[#25d366] text-white hover:brightness-105`} data-testid="send-whatsapp">
          <MessageCircle size={16} /> {m.whatsapp}
        </a>
        <a href={smsLink(phone, text)} onClick={() => log("sms")} className={`${button} border border-line hover:bg-panel-2`} data-testid="send-sms">
          <Smartphone size={16} /> {m.sms}
        </a>
        <button
          type="button"
          className={`${button} border border-line hover:bg-panel-2`}
          onClick={() => {
            navigator.clipboard?.writeText(text).catch(() => {});
            setCopied(true);
            log("copy");
          }}
        >
          <Copy size={16} /> {copied ? m.copied : m.copy}
        </button>
      </div>
    </Card>
  );
}
