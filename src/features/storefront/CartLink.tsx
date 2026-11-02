"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { ShoppingCart } from "lucide-react";
import { cartCount, onCartChange, writeCart } from "./cart";

// The header's cart icon with the number of pieces (Apps → Shopping cart)
export function CartLink({ shopId, href, label }: { shopId: string; href: string; label: string }) {
  const count = useSyncExternalStore(onCartChange, () => cartCount(shopId), () => 0);
  return (
    <Link href={href} aria-label={label} className="relative flex size-9 items-center justify-center rounded-full border border-s-edge text-s-text hover:border-brand hover:text-brand-ink" data-testid="cart-link">
      <ShoppingCart size={17} />
      {count > 0 && (
        <span className="absolute -end-1 -top-1 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-brand-fg" data-testid="cart-count">
          {count}
        </span>
      )}
    </Link>
  );
}

// On the thank-you page of a cart order: the cart is emptied
export function ClearCart({ shopId }: { shopId: string }) {
  useEffect(() => writeCart(shopId, []), [shopId]);
  return null;
}
