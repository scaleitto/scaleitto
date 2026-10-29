import { connection } from "next/server";
import { getDictionary, asLocale } from "@/i18n";
import { requirePlatformAdmin } from "@/server/auth/context";
import { formatDate } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/ui";
import { appliedMigrations, recentErrors } from "@/features/admin/queries";
import { adminSystemCheck } from "@/features/admin/actions";
import { ClearErrorsButton, TestMailButton } from "@/features/admin/AdminForms";
import { CheckCard } from "@/ui/CheckCard";
import { cronKey } from "@/server/crypto";

// Every server setting the platform reads (values are never shown, only whether they are set)
const ENV_KEYS = [
  "DATABASE_URL", "APP_URL", "ROOT_DOMAIN", "APP_SECRET", "PLATFORM_ADMIN_EMAIL", "UPLOADS_DIR", "TZ",
  "OPENAI_API_KEY", "OPENAI_MODEL",
  "PAYMENT_HOLDER", "PAYMENT_CCP", "PAYMENT_RIB", "PAYMENT_WHATSAPP",
  "DOMAIN_CNAME_TARGET", "SERVER_IP", "SHOP_SUBDOMAINS",
  "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "SMTP_SECURE",
];

export default async function AdminSystem({ params }: PageProps<"/[lang]/admin/system">) {
  const lang = asLocale((await params).lang);
  await requirePlatformAdmin(lang);
  await connection();
  const t = getDictionary(lang);
  const sy = t.admin.system;
  const [errors, migrations] = await Promise.all([recentErrors(), appliedMigrations()]);
  return (
    <>
      <PageHeader title={t.admin.nav.system} />
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted">{sy.version}</span>
            <code dir="ltr">{process.env.BUILD_COMMIT ?? "—"}</code>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">{sy.builtAt}</span>
            <code dir="ltr">{process.env.BUILD_TIME ?? "—"}</code>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">{sy.node}</span>
            <code dir="ltr">{process.version}</code>
          </div>
          <div>
            <p className="mt-3 mb-1.5 font-semibold">{sy.migrations}</p>
            <div className="flex flex-wrap gap-1" dir="ltr">
              {migrations.map((m) => (
                <Badge key={m}>{m}</Badge>
              ))}
            </div>
          </div>
        </Card>
        <Card className="text-sm" data-testid="env-status">
          <p className="mb-2 font-semibold">{sy.env}</p>
          <ul className="grid gap-1 sm:grid-cols-2" dir="ltr">
            {ENV_KEYS.map((k) => (
              <li key={k} className="flex justify-between gap-2 font-mono text-xs" data-env={k}>
                <span>{k}</span>
                {process.env[k] ? <span className="text-accent">✓ {sy.set}</span> : <span className="text-muted">— {sy.missing}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="mb-6">
        <CheckCard
          run={adminSystemCheck.bind(null, lang)}
          labels={{ ...sy.check.steps, ...Object.fromEntries(Object.entries(t.landingPages.ai.testSteps).map(([k, v]) => [`ai-${k}`, v])) }}
          t={sy.check}
          testId="system-check"
        />
      </div>
      <Card className="mb-6 space-y-2 text-sm">
        <h2 className="font-semibold">{sy.mailTitle}</h2>
        <p className="text-muted">{sy.mailHint}</p>
        <TestMailButton lang={lang} t={{ admin: t.admin, plans: t.plans, errors: t.errors, common: t.common }} />
      </Card>
      <Card className="mb-6 space-y-2 text-sm" data-testid="cron">
        <h2 className="font-semibold">{sy.cron}</h2>
        <p className="text-muted">{sy.cronHint}</p>
        <code className="block rounded-lg border border-line bg-panel-2 p-3 text-xs break-all select-all" dir="ltr">
          {`curl -fsS "${(process.env.APP_URL ?? "").replace(/\/$/, "")}/api/cron/apps?key=${cronKey()}" > /dev/null`}
        </code>
      </Card>
      <Card className="space-y-3" data-testid="error-log">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">
            {sy.errors} ({errors.length})
          </h2>
          {errors.length > 0 && <ClearErrorsButton lang={lang} t={{ admin: t.admin, plans: t.plans, errors: t.errors, common: t.common }} />}
        </div>
        {errors.length === 0 ? (
          <p className="text-sm text-muted">{sy.noErrors}</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {errors.map((e) => (
              <li key={e.id} className="py-2" data-error={e.path ?? ""}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs text-muted">
                    <bdi>{formatDate(e.createdAt, lang)}</bdi>
                  </span>
                  <code className="text-xs text-accent" dir="ltr">
                    {e.path}
                  </code>
                </div>
                <p className="break-all" dir="ltr">
                  {e.message}
                </p>
                {e.stack && (
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">{sy.stack}</summary>
                    <pre className="mt-1 max-h-60 overflow-auto rounded bg-bg p-2 text-xs whitespace-pre-wrap text-muted" dir="ltr">
                      {e.stack}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
