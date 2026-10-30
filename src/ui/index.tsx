// Shared dashboard UI (design-system/scaleitto/MASTER.md). Every page builds on these instead of repeating class lists.
import type { ComponentProps, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// Focus is always visible: a soft green ring around the control
const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-accent/30";

const buttonVariants = {
  primary: "bg-accent text-accent-fg shadow-[0_1px_2px_rgba(79,59,214,.25),inset_0_1px_0_rgba(255,255,255,.12)] hover:bg-[#3f2db8]",
  secondary: "border border-line bg-panel text-fg shadow-[0_1px_2px_rgba(16,24,40,.05)] hover:border-muted/40 hover:bg-panel-2",
  ghost: "text-muted hover:bg-panel-2 hover:text-fg",
  danger: "text-danger hover:bg-danger/10",
};

export function buttonClass(variant: keyof typeof buttonVariants = "primary", extra?: string) {
  return cx(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
    focusRing,
    buttonVariants[variant],
    extra,
  );
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: keyof typeof buttonVariants }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

// A white block on the page canvas. Its first h2 is the block's title.
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx(
        "rounded-[14px] border border-line bg-panel shadow-[0_1px_2px_rgba(16,24,40,.05),0_8px_24px_-12px_rgba(16,24,40,.12)] [&>h2:first-child]:text-base [&>h2:first-child]:font-bold [&>h2:first-child]:text-fg",
        // A page may give its own padding (p-0 for tables)
        !/(^|\s)p-\d/.test(className ?? "") && "p-5",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl leading-tight font-bold tracking-tight text-fg sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const inputClass = cx(
  "w-full rounded-[10px] border border-field-line bg-field px-3 py-2.5 text-sm text-fg shadow-[inset_0_1px_2px_rgba(16,24,40,.04)] transition-colors duration-150 placeholder:text-muted/60",
  "hover:border-muted/50 focus:border-accent focus:bg-panel focus:outline-none focus:ring-[3px] focus:ring-accent/20",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "min-h-24 leading-relaxed", className)} {...props} />;
}

// Native select (keyboard and screen readers work as usual) with its own chevron, on the correct side in RTL
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, "select-chevron cursor-pointer appearance-none pe-9", className)} {...props} />;
}

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor?: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs font-medium text-danger" role="alert">
          <CircleAlert size={13} className="shrink-0" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const alertStyles = {
  error: { box: "border-danger/25 bg-danger/[0.06] text-danger", icon: CircleAlert },
  success: { box: "border-accent/25 bg-accent/[0.07] text-accent", icon: CircleCheck },
  info: { box: "border-info/20 bg-info/[0.06] text-fg", icon: Info },
};

export function Alert({ variant = "error", children }: { variant?: "error" | "success" | "info"; children: ReactNode }) {
  const { box, icon: Icon } = alertStyles[variant];
  return (
    <div role={variant === "error" ? "alert" : "status"} className={cx("flex items-start gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-sm leading-relaxed", box)}>
      <Icon size={17} className={cx("mt-0.5 shrink-0", variant === "info" && "text-info")} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// A status pill: tinted, with a dot, and always a word (never color alone)
export type Tone = "neutral" | "accent" | "warning" | "danger" | "info" | "violet" | "orange";
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    neutral: "bg-panel-2 text-muted ring-line",
    accent: "bg-accent/10 text-accent ring-accent/20",
    warning: "bg-warning/10 text-warning ring-warning/20",
    danger: "bg-danger/10 text-danger ring-danger/20",
    info: "bg-info/10 text-info ring-info/20",
    violet: "bg-violet-soft text-violet ring-violet/20",
    orange: "bg-warning-soft text-warning ring-warning/20",
  };
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset", tones[tone])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 border-dashed py-14 text-center shadow-none">
      {icon && <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">{icon}</div>}
      <h2 className="text-lg font-bold text-fg">{title}</h2>
      {children && <div className="max-w-md text-sm leading-relaxed text-muted">{children}</div>}
    </Card>
  );
}
