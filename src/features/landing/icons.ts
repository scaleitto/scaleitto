import {
  BadgeCheck, Baby, Battery, Clock, Droplet, Dumbbell, Feather, Flame, Gift, Hand, Heart, Home, Leaf, Lock, Maximize, Moon, Package,
  Recycle, Ruler, Shield, Smile, Snowflake, Sparkles, Sun, ThumbsUp, Timer, Truck, Volume2, Wallet, Wifi, Wrench, Zap, type LucideIcon,
} from "lucide-react";

// Icons for benefit cards (SVG, never emoji): the AI and the editor pick one by name
export const benefitIcons: Record<string, LucideIcon> = {
  sparkles: Sparkles, check: BadgeCheck, shield: Shield, lock: Lock, heart: Heart, smile: Smile, "thumbs-up": ThumbsUp,
  battery: Battery, zap: Zap, wifi: Wifi, volume: Volume2, clock: Clock, timer: Timer, droplet: Droplet, snowflake: Snowflake,
  flame: Flame, sun: Sun, moon: Moon, leaf: Leaf, recycle: Recycle, feather: Feather, ruler: Ruler, size: Maximize,
  package: Package, gift: Gift, truck: Truck, wallet: Wallet, home: Home, baby: Baby, hand: Hand, dumbbell: Dumbbell, tool: Wrench,
};
export const benefitIconNames = Object.keys(benefitIcons);
export const isBenefitIcon = (name: string) => Object.hasOwn(benefitIcons, name);
