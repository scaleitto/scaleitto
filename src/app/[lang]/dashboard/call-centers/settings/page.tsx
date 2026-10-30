import { redirect } from "next/navigation";
import { getDictionary, asLocale } from "@/i18n";
import { requireSection } from "@/server/auth/context";
import { sectionHref } from "@/lib/permissions";
import { AssignSettings } from "@/features/team/AssignSettings";
import { distributionBoard } from "@/features/team/distribution";
import { DistributionBoard } from "@/features/team/DistributionBoard";
import { CallCenterHeader } from "@/features/team/views";
import { MessagesEditor } from "@/features/messages/MessagesEditor";
import { OpenOrders } from "@/features/team/OpenOrders";
import { assignableMembers } from "@/features/team/queries";
import { PENDING_STATUSES } from "@/features/orders/statuses";
import { db, schema } from "@/server/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { resolveMessages } from "@/features/messages/templates";

export default async function AssignSettingsPage({ params }: PageProps<"/[lang]/dashboard/call-centers/settings">) {
  const lang = asLocale((await params).lang);
  const t = getDictionary(lang);
  const { shop, role } = await requireSection(lang, "callCenters");
  if (role === "agent") redirect(sectionHref(lang, "callCenters"));
  const messages = resolveMessages(shop.messages);
  const [board, members] = await Promise.all([distributionBoard(shop.id), assignableMembers(shop.id)]);
  // The orders still to confirm (the newest 200), to hand out by hand
  const o = schema.orders;
  const open = await db
    .select({ id: o.id, number: o.number, customerName: o.customerName, phone: o.phone, wilayaCode: o.wilayaCode, status: o.status, assigneeName: schema.users.name, createdAt: o.createdAt })
    .from(o)
    .leftJoin(schema.users, eq(schema.users.id, o.assignedTo))
    .where(and(eq(o.shopId, shop.id), eq(o.locked, false), inArray(o.status, [...PENDING_STATUSES])))
    .orderBy(desc(o.createdAt))
    .limit(200);
  return (
    <>
      <CallCenterHeader lang={lang} t={t} current="settings" />
      <AssignSettings lang={lang} mode={shop.assignMode} t={{ team: t.team, errors: t.errors, common: t.common }} />
      <DistributionBoard lang={lang} mode={shop.assignMode} board={board} t={t} />
      <OpenOrders lang={lang} rows={open} members={members} orderBase={sectionHref(lang, "orders")} t={t} />
      <MessagesEditor lang={lang} language={messages.language} texts={messages.texts} t={{ assistant: t.assistant, errors: t.errors, common: t.common, landingPages: t.landingPages }} />
    </>
  );
}
