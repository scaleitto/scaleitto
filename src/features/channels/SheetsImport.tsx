"use client";

import { useState, useTransition } from "react";
import { FileSpreadsheet, Wand2 } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Alert, Button, Card, Field, Input, Select, Textarea } from "@/ui";
import { FormMessage, SubmitButton, fieldError, useActionForm } from "@/ui/form";
import { saveSheetImport, setChannelActive } from "./actions";
import { CopyBox, ChannelStatus } from "./ChannelCards";
import type { ChannelView } from "./queries";
import { detectColumns, requiredSheetFields, sheetColumnLabel, sheetFields, splitHeaders, type SheetColumns } from "./sheets";

type Text = Pick<Dictionary, "channels" | "errors">;

// Connected platforms → Google Sheets → Import orders (Zimam): paste the header row, "Detect columns" suggests which column
// holds each field (correctable), the script address for the statuses; once saved, the script to paste into the sheet
export function SheetsImport({ lang, view, lastOrder, t }: { lang: string; view: ChannelView | null; lastOrder: string | null; t: Text }) {
  const s = t.channels.sheets;
  const errors = t.errors as Record<string, string>;
  const saved = view?.settings ?? null;
  const [headerText, setHeaderText] = useState(saved ? saved.headers.join(", ") : "");
  const [headers, setHeaders] = useState<string[]>(saved?.headers ?? []);
  const [columns, setColumns] = useState<SheetColumns | null>(saved?.columns ?? null);
  const { state, pending, onSubmit } = useActionForm(saveSheetImport.bind(null, lang));
  const [busy, start] = useTransition();
  const detect = () => {
    const h = splitHeaders(headerText);
    setHeaders(h);
    setColumns(detectColumns(h));
  };
  return (
    <div className="space-y-5" data-testid="sheets-import">
      <Card className="space-y-2">
        <ChannelStatus connected={Boolean(view)} active={view?.active ?? false} t={t} />
        <p className="text-sm text-muted" data-testid="channel-receiving">
          {!view ? t.channels.notReceiving : view.ordersCount ? fmt(t.channels.receiving, { n: view.ordersCount, at: lastOrder ?? "" }) : t.channels.receivingNone}
        </p>
      </Card>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Card className="space-y-4">
          <Field label={s.headers} htmlFor="sheet-headers" hint={s.headersHint} error={fieldError(state, errors, "headers")}>
            <Textarea id="sheet-headers" name="headers" rows={2} dir="auto" value={headerText} onChange={(e) => setHeaderText(e.target.value)} placeholder={s.headersPlaceholder} data-testid="sheet-headers" />
          </Field>
          <Button type="button" variant="secondary" onClick={detect} disabled={!headerText.trim()} data-testid="detect-columns">
            <Wand2 size={15} /> {s.detect}
          </Button>
          {columns && headers.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2" data-testid="sheet-columns">
              {sheetFields.map((f) => (
                <Field key={f} label={`${s.fields[f]}${requiredSheetFields.includes(f) ? " *" : ""}`} htmlFor={`col-${f}`} hint={f === "status" ? s.statusHint : undefined} error={fieldError(state, errors, `col_${f}`)}>
                  <Select id={`col-${f}`} name={`col_${f}`} value={columns[f] ?? ""} onChange={(e) => setColumns({ ...columns, [f]: e.target.value === "" ? null : Number(e.target.value) })} data-field={f}>
                    <option value="">{s.noColumn}</option>
                    {headers.map((_, i) => (
                      <option key={i} value={i}>
                        {sheetColumnLabel(headers, i)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
          )}
          <Field label={s.scriptUrl} htmlFor="sheet-script-url" hint={s.scriptUrlHint} error={fieldError(state, errors, "scriptUrl")}>
            <Input id="sheet-script-url" name="scriptUrl" dir="ltr" defaultValue={saved?.scriptUrl ?? ""} placeholder="https://script.google.com/macros/s/…/exec" data-testid="sheet-script-url" />
          </Field>
          <FormMessage state={state} errors={errors} success={s.saved} />
          <SubmitButton pending={pending} disabled={!columns} data-testid="save-sheet-import">
            {s.save}
          </SubmitButton>
        </Card>
      </form>
      {view?.script && (
        <Card className="space-y-4" data-testid="sheet-script">
          <h2 className="flex items-center gap-2 font-bold">
            <FileSpreadsheet size={18} className="text-accent" /> {s.scriptTitle}
          </h2>
          <ol className="list-decimal space-y-1.5 ps-5 text-sm text-muted">
            {s.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <CopyBox label={s.scriptLabel} value={view.script} testId="sheet-script-code" t={t} />
          <Alert variant="info">{s.limits}</Alert>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => start(async () => void (await setChannelActive(lang, "google_sheets", !view.active)))} data-testid="channel-toggle">
            {view.active ? t.channels.pause : t.channels.resume}
          </Button>
        </Card>
      )}
    </div>
  );
}
