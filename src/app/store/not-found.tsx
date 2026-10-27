import { SearchX } from "lucide-react";

// Store pages that do not exist (unknown product, closed shop…). Kept language-neutral on purpose.
export default function StoreNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center text-s-muted">
      <SearchX size={40} />
      <p className="text-lg font-semibold">404</p>
    </div>
  );
}
