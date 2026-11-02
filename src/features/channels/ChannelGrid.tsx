import Link from "next/link";
import { ExternalLink, FileSpreadsheet, ShoppingBag, Store, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { fmt } from "@/lib/format";
import { Badge, Card, buttonClass } from "@/ui";

export const channelPages = ["google_sheets", "shopify", "woocommerce"] as const;
export type ChannelPage = (typeof channelPages)[number];

export type ChannelTile = {
  key: string;
  name: string;
  // null = not verified yet (coming)
  page: ChannelPage | null;
  connected: boolean;
  active: boolean;
  orders: number;
  lastOrder: string | null;
};

const icons: Record<string, LucideIcon> = { google_sheets: FileSpreadsheet, shopify: ShoppingBag, woocommerce: Store };

// Zimam's connected platforms: one card each (mark, status, what it receives, a wide "Connect" button opening its page)
export function ChannelGrid({ base, tiles, t }: { base: string; tiles: ChannelTile[]; t: Pick<Dictionary, "channels"> }) {
  const c = t.channels;
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((tile) => {
        const Icon = icons[tile.key] ?? Store;
        return (
          <Card
            key={tile.key}
            className="flex flex-col gap-4 p-6"
            data-channel={tile.page ? tile.key : undefined}
            data-channel-soon={tile.page ? undefined : tile.name}
            data-state={!tile.connected ? "off" : tile.active ? "on" : "paused"}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-14 place-items-center rounded-xl border border-line bg-panel-2 text-accent">
                <Icon size={26} />
              </span>
              <div className="flex flex-col items-end gap-1.5 text-[11px] uppercase">
                <Badge tone={!tile.page ? "neutral" : !tile.connected ? "neutral" : tile.active ? "accent" : "warning"}>
                  {!tile.page ? c.soon : !tile.connected ? c.notConnected : tile.active ? c.connected : c.paused}
                </Badge>
                {tile.page && tile.page !== "google_sheets" && (
                  <span title={c.mayMissHint}>
                    <Badge tone="orange">{c.mayMiss}</Badge>
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{tile.name}</h2>
              <p className="mt-1 text-sm text-muted" data-testid="channel-receiving">
                {!tile.page ? c.soonHint : !tile.connected ? c.notReceiving : tile.orders ? fmt(c.receiving, { n: tile.orders, at: tile.lastOrder ?? "" }) : c.receivingNone}
              </p>
            </div>
            {tile.page ? (
              <Link href={`${base}/${tile.page}`} className={buttonClass("primary", "w-full")} data-testid="channel-open">
                <ExternalLink size={15} /> {tile.connected ? c.manage : c.connect}
              </Link>
            ) : (
              <span className={buttonClass("secondary", "w-full pointer-events-none opacity-60")}>{c.soon}</span>
            )}
          </Card>
        );
      })}
    </div>
  );
}
