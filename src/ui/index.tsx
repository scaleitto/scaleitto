// Shared dashboard UI. Every page builds on these instead of repeating class lists.
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const buttonVariants = {
  primary: "bg-accent text-accent-fg hover:brightness-110",
  secondary: "border border-line bg-panel text-fg shadow-sm shadow-black/[0.03] hover:bg-panel-2",
  ghost: "text-muted hover:bg-panel-2 hover:text-fg",
  danger: "text-danger hover:bg-danger/10",
};

export function buttonClass(variant: keyof typeof buttonVariants = "primary", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    buttonVariants[variant],
    extra,
  );
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: keyof typeof buttonVariants }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-xl border border-line bg-panel p-5", className)} {...props} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-fg">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-fg shadow-sm shadow-black/[0.02] placeholder:text-muted/70 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, className)} {...props} />;
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor?: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Alert({ variant = "error", children }: { variant?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-danger/30 bg-danger/10 text-danger",
    success: "border-accent/30 bg-accent/10 text-accent",
    info: "border-line bg-panel-2 text-fg",
  };
  return (
    <div role={variant === "error" ? "alert" : "status"} className={cx("rounded-lg border px-3 py-2 text-sm", styles[variant])}>
      {children}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warning" | "danger" | "info" }) {
  const tones = {
    neutral: "bg-panel-2 text-muted",
    accent: "bg-accent/15 text-accent",
    warning: "bg-amber-400/15 text-warning",
    danger: "bg-danger/15 text-danger",
    info: "bg-sky-400/15 text-info",
  };
  return <span className={cx("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {children && <div className="text-sm text-muted">{children}</div>}
    </Card>
  );
}
