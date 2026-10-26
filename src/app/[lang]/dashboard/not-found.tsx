"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { Card, buttonClass } from "@/ui";

// Shown inside the dashboard when an item does not exist or belongs to another shop.
// Strings live here so the page does not load whole dictionaries in the browser.
const text = {
  ar: { title: "العنصر غير موجود", body: "ربما تم حذفه أو أن الرابط غير صحيح.", home: "العودة إلى الرئيسية" },
  fr: { title: "Élément introuvable", body: "Il a peut-être été supprimé ou le lien est incorrect.", home: "Retour à l'accueil" },
  en: { title: "Not found", body: "It may have been deleted, or the link is wrong.", home: "Back to overview" },
};

export default function DashboardNotFound() {
  const { lang } = useParams<{ lang: string }>();
  const t = text[lang as keyof typeof text] ?? text.ar;
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center" data-testid="not-found">
      <SearchX size={36} className="text-muted" aria-hidden />
      <h1 className="text-lg font-semibold">{t.title}</h1>
      <p className="text-sm text-muted">{t.body}</p>
      <Link href={`/${lang}/dashboard`} className={buttonClass("secondary")}>
        {t.home}
      </Link>
    </Card>
  );
}
