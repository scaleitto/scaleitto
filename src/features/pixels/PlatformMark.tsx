import type { PixelPlatform } from "@/server/db/schema";

// Small drawn marks so each platform is recognised at a glance on the Pixels grid and its page
export function PlatformMark({ platform, size = 28 }: { platform: PixelPlatform; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  switch (platform) {
    case "gtm":
      return (
        <svg {...common}>
          <rect x="5" y="5" width="14" height="14" rx="2.5" transform="rotate(45 12 12)" fill="#4285F4" />
          <rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1" transform="rotate(45 12 12)" fill="#fff" />
        </svg>
      );
    case "ga4":
      return (
        <svg {...common}>
          <rect x="15" y="3" width="5" height="18" rx="2.5" fill="#F9AB00" />
          <rect x="9.5" y="10" width="5" height="11" rx="2.5" fill="#E37400" />
          <circle cx="6.5" cy="18.5" r="2.5" fill="#E37400" />
        </svg>
      );
    case "meta":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill="#1877F2" />
          <path d="M13.4 22v-7.3h2.4l.4-2.9h-2.8V10c0-.8.3-1.4 1.4-1.4h1.5V6.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.6 1.3-3.6 3.7v2.1H8.1v2.9h2.4V22z" fill="#fff" />
        </svg>
      );
    case "snapchat":
      return (
        <svg {...common}>
          <rect x="1" y="1" width="22" height="22" rx="6" fill="#FFFC00" />
          <path
            d="M12 4.5c2.6 0 4.3 1.9 4.3 4.3v1.9l1.3-.4c.5 0 .7.5.3.8l-1.5.9c.6 1.6 1.7 2.7 3.1 3.2-.3.6-1.2.8-2.1.9-.2.5-.2.9-.6.9-.6 0-1.3-.3-2.2.2-.8.4-1.4 1.2-2.6 1.2s-1.8-.8-2.6-1.2c-.9-.5-1.6-.2-2.2-.2-.4 0-.4-.4-.6-.9-.9-.1-1.8-.3-2.1-.9 1.4-.5 2.5-1.6 3.1-3.2l-1.5-.9c-.4-.3-.2-.8.3-.8l1.3.4V8.8c0-2.4 1.7-4.3 4.3-4.3z"
            fill="#fff"
            stroke="#111"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M14.6 3h2.6c.2 1.9 1.5 3.2 3.4 3.4v2.6c-1.3 0-2.4-.4-3.4-1.1v6.2a5 5 0 1 1-5-5h.3v2.7h-.3a2.3 2.3 0 1 0 2.4 2.3z" fill="#25F4EE" transform="translate(-0.7 -0.5)" />
          <path d="M14.6 3h2.6c.2 1.9 1.5 3.2 3.4 3.4v2.6c-1.3 0-2.4-.4-3.4-1.1v6.2a5 5 0 1 1-5-5h.3v2.7h-.3a2.3 2.3 0 1 0 2.4 2.3z" fill="#FE2C55" transform="translate(0.7 0.5)" />
          <path d="M14.6 3h2.6c.2 1.9 1.5 3.2 3.4 3.4v2.6c-1.3 0-2.4-.4-3.4-1.1v6.2a5 5 0 1 1-5-5h.3v2.7h-.3a2.3 2.3 0 1 0 2.4 2.3z" fill="#111" />
        </svg>
      );
  }
}

// Zimam's order on the grid
export const gridOrder: PixelPlatform[] = ["gtm", "ga4", "meta", "snapchat", "tiktok"];
