"use client";

// Store settings → MCP (Zimam): the server URL, "Create a token" (name, read / write access, consent), the tokens and the
// connected apps (MCP clients that used a token), each revocable.
import { useState, useTransition } from "react";
import { Copy, KeyRound, Plus } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { formatDate } from "@/lib/format";
import { Alert, Button, Card, Field, Input } from "@/ui";
import { readScopes, writeScopes, type McpScope } from "@/features/mcp/scopes";
import { createMcpToken, revokeMcpClient, revokeMcpToken } from "./actions";

type Token = { id: string; name: string; scopes: string[]; client: string | null; lastUsedAt: string | null; createdAt: string };

export function McpPanel({ lang, serverUrl, tokens, t }: { lang: string; serverUrl: string; tokens: Token[]; t: Pick<Dictionary, "settings" | "errors" | "common"> }) {
  const m = t.settings.mcp;
  const e = t.errors as Record<string, string>;
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<McpScope[]>([...readScopes]);
  const [consent, setConsent] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const copy = (key: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopied(key);
  };
  const toggle = (s: McpScope) => setScopes(scopes.includes(s) ? scopes.filter((x) => x !== s) : [...scopes, s]);
  const box = (s: McpScope) => (
    <label key={s} className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(s)} className="size-4 accent-[var(--color-accent)]" data-scope={s} />
      {m.scopes[s]}
    </label>
  );
  const clients = [...new Set(tokens.map((x) => x.client).filter((c): c is string => Boolean(c)))];
  return (
    <Card className="space-y-6" data-testid="settings-mcp">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound size={18} /> {m.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{m.hint}</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-fg-2">{m.serverUrl}</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-panel-2 px-3 py-2 font-mono text-sm" dir="ltr" data-testid="mcp-url">
            {serverUrl}
          </code>
          <button type="button" className="grid size-9 place-items-center rounded-lg border border-line hover:bg-panel-2" aria-label={m.copy} onClick={() => copy("url", serverUrl)}>
            <Copy size={15} />
          </button>
        </div>
        <p className="text-xs text-muted">{m.serverHint}</p>
      </div>

      <fieldset className="space-y-4 rounded-xl border border-line p-4">
        <legend className="px-1 font-semibold">{m.create}</legend>
        <Field label={m.name} htmlFor="mcp-name">
          <Input id="mcp-name" maxLength={80} placeholder={m.namePlaceholder} value={name} onChange={(ev) => setName(ev.target.value)} />
        </Field>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-fg-2">{m.access}</p>
          <div className="grid gap-2 sm:grid-cols-2">{readScopes.map(box)}</div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-fg-2">{m.writeAccess}</p>
          <div className="grid gap-2">{writeScopes.map(box)}</div>
        </div>
        <label className="flex items-start gap-3 rounded-xl bg-panel-2 p-3 text-sm">
          <input type="checkbox" checked={consent} onChange={(ev) => setConsent(ev.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" data-testid="mcp-consent" />
          {m.consent}
        </label>
        {error && <Alert variant="error">{error}</Alert>}
        <Button
          type="button"
          disabled={!consent || !name.trim() || !scopes.length || pending}
          onClick={() =>
            start(async () => {
              const r = await createMcpToken(lang, { name, scopes, consent });
              if (r.ok && r.token) {
                setCreated(r.token);
                setName("");
                setError(null);
              } else setError(e[r.error ?? "unexpected"] ?? e.unexpected);
            })
          }
          data-testid="mcp-create"
        >
          <Plus size={15} /> {m.create}
        </Button>
        {created && (
          <Alert variant="success">
            <span className="block font-semibold">{m.createdTitle}</span>
            <span className="block text-xs">{m.createdHint}</span>
            <span className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white/70 px-2 py-1 font-mono text-xs text-fg" dir="ltr" data-testid="mcp-token">
                {created}
              </code>
              <Button type="button" variant="secondary" className="h-8" onClick={() => copy("token", created)}>
                <Copy size={13} /> {copied === "token" ? m.copied : m.copy}
              </Button>
            </span>
          </Alert>
        )}
      </fieldset>

      {tokens.length === 0 ? (
        <p className="text-sm text-muted">{m.noTokens}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line" data-testid="mcp-tokens">
          {tokens.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-3 p-3 text-sm" data-token={x.name}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{x.name}</p>
                <p className="text-xs text-muted">
                  {x.scopes.map((s) => m.scopes[s as McpScope] ?? s).join(" · ")}
                </p>
                <p className="text-xs text-muted">
                  {formatDate(new Date(x.createdAt), lang)}
                  {x.lastUsedAt ? ` · ${m.lastUsed} ${formatDate(new Date(x.lastUsedAt), lang)}` : ` · ${m.neverUsed}`}
                  {x.client ? ` · ${x.client}` : ""}
                </p>
              </div>
              <Button type="button" variant="secondary" className="h-8 text-danger" disabled={pending} onClick={() => confirm(m.confirmRevoke) && start(async () => void (await revokeMcpToken(lang, x.id)))} data-action="revoke">
                {m.revoke}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 border-t border-line pt-5">
        <p className="font-semibold">{m.apps}</p>
        <p className="text-xs text-muted">{m.appsHint}</p>
        {clients.length === 0 ? (
          <p className="text-sm text-muted">{m.noApps}</p>
        ) : (
          <ul className="space-y-2" data-testid="mcp-apps">
            {clients.map((c) => (
              <li key={c} className="flex items-center justify-between gap-3 rounded-lg bg-panel-2 px-3 py-2 text-sm">
                <span className="font-semibold">{c}</span>
                <Button type="button" variant="secondary" className="h-8 text-danger" disabled={pending} onClick={() => confirm(m.confirmRevoke) && start(async () => void (await revokeMcpClient(lang, c)))}>
                  {m.revoke}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
