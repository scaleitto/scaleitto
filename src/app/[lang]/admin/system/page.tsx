import { desc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { aiConfigured, aiModel, DEFAULT_MODELS } from "@/lib/ai/openai";
import { AiCheck } from "./AiCheck";
import { checkAi, checkUploads, clearErrors, pollBackgroundCheck, startBackgroundCheck } from "./actions";
import { SelfTest } from "./SelfTest";

const ENV_KEYS = ["DATABASE_URL", "APP_URL", "ROOT_DOMAIN", "PLATFORM_ADMIN_EMAIL", "TZ", "OPENAI_API_KEY", "OPENAI_MODEL"];

export default async function SystemPage({ params }: PageProps<"/[lang]/admin/system">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  await requireAdmin(lang);
  const a = t.admin;

  const [errors, [migrations]] = await Promise.all([
    db.select().from(schema.errorLogs).orderBy(desc(schema.errorLogs.createdAt)).limit(50),
    db.execute(sql`SELECT name FROM _migrations ORDER BY name`) as unknown as Promise<[{ name: string }[]]>,
  ]);
  const chain = [...new Set([aiModel(), ...DEFAULT_MODELS])];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{a.system}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-2 text-sm">
          <div className="flex justify-between"><span>{a.version}</span><b dir="ltr" className="font-mono">{process.env.BUILD_COMMIT}</b></div>
          <div className="flex justify-between"><span>{a.builtAt}</span><span dir="ltr">{process.env.BUILD_TIME}</span></div>
          <div>
            <div className="mt-3 font-semibold">{a.migrations}</div>
            <div className="mt-1 flex flex-wrap gap-1" dir="ltr">
              {migrations.map((m) => (
                <span key={m.name} className="badge bg-slate-100 font-mono text-slate-700">{m.name}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="card text-sm">
          <div className="mb-2 font-semibold">{a.settingsStatus}</div>
          <ul className="space-y-1" dir="ltr">
            {ENV_KEYS.map((k) => (
              <li key={k} className="flex justify-between font-mono">
                <span>{k}</span>
                {process.env[k] ? <span className="text-green-700">✓ set</span> : <span className="text-slate-400">—</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card space-y-3 border-2 border-brand/30">
        <div>
          <h2 className="font-bold">{a.selfTest}</h2>
          <p className="mt-1 text-sm text-slate-500">{a.selfTestHint}</p>
        </div>
        <SelfTest
          t={t}
          chain={chain}
          checkUploads={checkUploads.bind(null, lang)}
          checkAi={checkAi.bind(null, lang)}
          startBackground={startBackgroundCheck.bind(null, lang)}
          pollBackground={pollBackgroundCheck.bind(null, lang)}
        />
      </div>

      <div className="card space-y-3">
        <h2 className="font-bold">{a.aiCheck}</h2>
        {aiConfigured() ? (
          <>
            <p className="text-sm">
              {a.aiModel}: <b dir="ltr" className="font-mono">{aiModel()}</b>
              <span className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                {a.aiFallback}:
                {chain.map((m, i) => (
                  <span key={m} className="badge bg-slate-100 font-mono text-slate-700" dir="ltr">{i + 1}. {m}</span>
                ))}
              </span>
            </p>
            <AiCheck t={t} check={checkAi.bind(null, lang)} chain={chain} />
          </>
        ) : (
          <p className="text-sm text-slate-600">{t.ai.notConfigured}</p>
        )}
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{a.errors}</h2>
          {errors.length > 0 && (
            <form action={clearErrors.bind(null, lang)}>
              <button className="btn-danger">{a.clearErrors}</button>
            </form>
          )}
        </div>
        {errors.length === 0 ? (
          <p className="text-sm text-slate-500">{a.noErrors}</p>
        ) : (
          <div className="space-y-2">
            {errors.map((e) => (
              <details key={e.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <summary className="cursor-pointer">
                  <span className="text-slate-500">{formatDate(e.createdAt, lang)}</span>
                  {" · "}
                  <span dir="ltr" className="font-mono">{e.method} {e.path}</span>
                  {e.digest && <span dir="ltr" className="ms-2 font-mono text-xs text-slate-400">#{e.digest}</span>}
                  <div className="mt-1 font-medium text-red-700" dir="ltr">{e.message}</div>
                </summary>
                {e.stack && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs" dir="ltr">{e.stack}</pre>}
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
