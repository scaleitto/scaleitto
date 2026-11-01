import { createHash } from "node:crypto";
import { connection } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDictionary, asLocale } from "@/i18n";
import { db, schema } from "@/server/db";
import { fmt } from "@/lib/format";
import { Alert, Card } from "@/ui";
import { Logo } from "@/ui/Logo";
import { AcceptInviteForm } from "@/features/team/AcceptInviteForm";
import { acceptInvite } from "@/features/team/invites";

// The page an invited teammate opens from the email: who invited them where, then name + password
export default async function InvitePage({ params }: PageProps<"/[lang]/invite/[token]">) {
  const { lang: rawLang, token } = await params;
  const lang = asLocale(rawLang);
  const t = getDictionary(lang);
  const a = t.team.invite.accept;
  await connection();
  const [invite] = /^[\w-]{20,100}$/.test(token)
    ? await db
        .select({ email: schema.memberInvites.email, role: schema.memberInvites.role, store: schema.shops.name })
        .from(schema.memberInvites)
        .innerJoin(schema.shops, eq(schema.shops.id, schema.memberInvites.shopId))
        .where(and(eq(schema.memberInvites.tokenHash, createHash("sha256").update(token).digest("hex")), isNull(schema.memberInvites.acceptedAt), gt(schema.memberInvites.expiresAt, new Date())))
    : [];
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo name={t.brand} />
        </div>
        <Card className="space-y-4" data-testid="invite-accept">
          {!invite ? (
            <Alert>{a.invalid}</Alert>
          ) : (
            <>
              <h1 className="text-xl font-bold">{fmt(a.title, { store: invite.store })}</h1>
              <p className="text-sm text-muted">{fmt(a.body, { role: invite.role === "owner" ? t.profile.roles.owner : t.team.invite.roles[invite.role], email: invite.email })}</p>
              <AcceptInviteForm action={acceptInvite.bind(null, lang, token)} t={{ team: t.team, errors: t.errors }} />
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
