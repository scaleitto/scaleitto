import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getDictionary, asLocale } from "@/i18n";
import { hashPassword, newId, requireOwner } from "@/lib/auth";
import { canAdd } from "@/lib/limits";

const staffRoles = ["admin", "confirmer"] as const;

const addSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(191),
  password: z.string().min(8).max(200),
  role: z.enum(staffRoles),
});

async function addMember(lang: string, formData: FormData) {
  "use server";
  const locale = asLocale(lang);
  const { shop } = await requireOwner(locale);
  const back = `/${locale}/dashboard/team`;
  const parsed = addSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`${back}?error=validation`);
  const d = parsed.data;
  if (!(await canAdd(shop.id, "maxStaff"))) redirect(`${back}?error=limit`);

  let [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, d.email));
  if (user) {
    const [member] = await db
      .select({ userId: schema.shopMembers.userId })
      .from(schema.shopMembers)
      .where(and(eq(schema.shopMembers.shopId, shop.id), eq(schema.shopMembers.userId, user.id)));
    if (member) redirect(`${back}?error=member`);
  } else {
    user = { id: newId() };
    await db.insert(schema.users).values({ id: user.id, email: d.email, name: d.name, passwordHash: await hashPassword(d.password), locale });
  }
  await db.insert(schema.shopMembers).values({ shopId: shop.id, userId: user.id, role: d.role });
  redirect(`${back}?added=1`);
}

async function changeRole(lang: string, userId: string, formData: FormData) {
  "use server";
  const locale = asLocale(lang);
  const { shop } = await requireOwner(locale);
  const role = z.enum(staffRoles).parse(formData.get("role"));
  await db
    .update(schema.shopMembers)
    .set({ role })
    .where(and(eq(schema.shopMembers.shopId, shop.id), eq(schema.shopMembers.userId, userId), ne(schema.shopMembers.role, "owner")));
  redirect(`/${locale}/dashboard/team`);
}

async function removeMember(lang: string, userId: string) {
  "use server";
  const locale = asLocale(lang);
  const { shop } = await requireOwner(locale);
  await db
    .delete(schema.shopMembers)
    .where(and(eq(schema.shopMembers.shopId, shop.id), eq(schema.shopMembers.userId, userId), ne(schema.shopMembers.role, "owner")));
  redirect(`/${locale}/dashboard/team`);
}

export default async function TeamPage({ params, searchParams }: PageProps<"/[lang]/dashboard/team">) {
  const lang = asLocale((await params).lang);
  const { error, added } = await searchParams;
  const t = getDictionary(lang);
  const { shop } = await requireOwner(lang);
  const tm = t.team;

  const members = await db
    .select({ userId: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.shopMembers.role })
    .from(schema.shopMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.shopMembers.userId))
    .where(eq(schema.shopMembers.shopId, shop.id));

  const errorText = error === "limit" ? tm.limitReached : error === "member" ? tm.alreadyMember : error ? t.auth.errors.validation : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{tm.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{tm.hint}</p>
      </div>
      {errorText && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorText}</p>}
      {added && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{t.common.saved} — {tm.passwordShare}</p>}

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>{t.auth.name}</th>
              <th>{t.auth.email}</th>
              <th>{tm.role}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId}>
                <td className="font-medium">{m.name}</td>
                <td dir="ltr" className="text-start">{m.email}</td>
                <td>
                  {m.role === "owner" ? (
                    <span className="badge bg-amber-100 text-amber-800">{tm.roles.owner}</span>
                  ) : (
                    <form action={changeRole.bind(null, lang, m.userId)} className="flex gap-2">
                      <select name="role" defaultValue={m.role} className="input w-40">
                        {staffRoles.map((r) => (
                          <option key={r} value={r}>{tm.roles[r]}</option>
                        ))}
                      </select>
                      <button className="btn-outline px-3 py-1 text-xs">{t.common.save}</button>
                    </form>
                  )}
                </td>
                <td>
                  {m.role !== "owner" && (
                    <form action={removeMember.bind(null, lang, m.userId)}>
                      <button className="btn-danger">{tm.remove}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={addMember.bind(null, lang)} className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">{tm.add}</h2>
        <div>
          <label className="label" htmlFor="name">{t.auth.name}</label>
          <input className="input" id="name" name="name" required minLength={2} />
        </div>
        <div>
          <label className="label" htmlFor="email">{t.auth.email}</label>
          <input className="input" id="email" name="email" type="email" required dir="ltr" />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.auth.password}</label>
          <input className="input" id="password" name="password" type="text" required minLength={8} dir="ltr" autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="role">{tm.role}</label>
          <select className="input" id="role" name="role" defaultValue="confirmer">
            {staffRoles.map((r) => (
              <option key={r} value={r}>{tm.roles[r]}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-500 sm:col-span-2">{tm.existingUser}</p>
        <div className="sm:col-span-2">
          <button className="btn">{tm.add}</button>
        </div>
      </form>
    </div>
  );
}
