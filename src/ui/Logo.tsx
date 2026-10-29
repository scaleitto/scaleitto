import { useId } from "react";

// The platform's mark: an "S" whose upper end turns into an arrow going forward — a store that grows ("scale it").
// The same drawing is the favicon (src/app/icon.svg).
export function LogoMark({ className = "size-9" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden role="img">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b7cf6" />
          <stop offset="1" stopColor="#3f2db8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path d="M21.5 9.25H14a4.25 4.25 0 0 0 0 8.5h4a4.25 4.25 0 0 1 0 8.5H9.5" fill="none" stroke="#fff" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 5.75l3.5 3.5-3.5 3.5" fill="none" stroke="#fff" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Mark + name, for headers
export function Logo({ name, className = "", markClass = "size-9", textClass = "text-xl" }: { name: string; className?: string; markClass?: string; textClass?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClass} />
      <span className={`font-bold tracking-tight ${textClass}`}>{name}</span>
    </span>
  );
}
