"use client";

import { useParams } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button, Card } from "@/ui";

// Shown inside the dashboard (the sidebar stays) when a page fails to render.
// The error itself is already saved to error_logs by onRequestError.
// Strings live here so the boundary does not load whole dictionaries in the browser.
const text = {
  ar: { title: "تعذر عرض هذه الصفحة", body: "حدث خطأ غير متوقع وتم تسجيله. حاول مرة أخرى.", retry: "إعادة المحاولة", code: "رمز الخطأ" },
  fr: { title: "Impossible d'afficher cette page", body: "Une erreur inattendue s'est produite et a été enregistrée. Réessayez.", retry: "Réessayer", code: "Code d'erreur" },
  en: { title: "This page could not be shown", body: "Something unexpected went wrong and it was logged. Please try again.", retry: "Try again", code: "Error code" },
};

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  const { lang } = useParams<{ lang: string }>();
  const t = text[lang as keyof typeof text] ?? text.ar;
  const digest = (error as { digest?: string } | null)?.digest;
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <TriangleAlert size={36} className="text-amber-300" aria-hidden />
      <h1 className="text-lg font-semibold">{t.title}</h1>
      <p className="text-sm text-muted">{t.body}</p>
      {digest && (
        <p className="text-xs text-muted" dir="ltr">
          {t.code}: {digest}
        </p>
      )}
      <Button variant="secondary" onClick={() => retry()}>
        {t.retry}
      </Button>
    </Card>
  );
}
