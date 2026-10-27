import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDictionary, asLocale } from "@/i18n";
import { requireUser } from "@/server/auth/context";
import { db, schema } from "@/server/db";
import { logout } from "@/features/auth/actions";
import { AuthShell } from "@/features/auth/components";
import { Alert, Button } from "@/ui";

// Shown to the members of a shop the platform suspended
export default async function SuspendedPage({ params }: PageProps<"/[lang]/suspended">) {
  const lang = asLocale((await params).lang);
  const user = await requireUser(lang);
  const [m] = await db.select({ status: schema.shops.status }).from(schema.shopMembers).innerJoin(schema.shops, eq(schema.shops.id, schema.shopMembers.shopId)).where(eq(schema.shopMembers.userId, user.id));
  if (m?.status === "active") redirect(`/${lang}/dashboard`);
  const t = getDictionary(lang);
  return (
    <AuthShell lang={lang} t={t} title={t.admin.suspended.title} subtitle={t.admin.suspended.body}>
      <div className="space-y-4" data-testid="shop-suspended">
        <Alert variant="info">{t.admin.suspended.contact}</Alert>
        <form action={logout.bind(null, lang)}>
          <Button type="submit" variant="secondary" className="w-full">
            {t.nav.logout}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
