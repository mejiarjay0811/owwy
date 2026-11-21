import {
  Banknote, Landmark, Smartphone, PiggyBank, LifeBuoy, CreditCard, TrendingUp, Wallet,
  Utensils, Coffee, ShoppingCart, ShoppingBag, Store, Shirt, Footprints, Sparkles,
  Car, Fuel, Bus, TrainFront, Bike, Plane, ParkingCircle, Route,
  House, Lightbulb, Droplets, Flame, Globe, Tv, KeyRound, Sofa, Hammer, Wrench,
  Users, Baby, Dog, Cat, HeartPulse, Pill, Stethoscope, Scissors, Glasses,
  GraduationCap, BookOpen, Laptop, Briefcase, Receipt, Landmark as Bank2, Handshake,
  Gamepad2, Clapperboard, Music, Dumbbell, Palette, Camera, Tent, Church,
  Package, Sprout, RefreshCw, CircleHelp, Gift, Ticket, Tag, Wifi, Phone,
  Soup, Cake, Beer, Salad, Apple, Beef, Milk,
  CalendarClock, Banknote as Cash2, Coins, Percent, ShieldCheck, Scale, Target, Trophy,
  Heart, Star, Anchor, Compass, Mountain, Waves, Sun, Moon, Umbrella, Leaf, TreePine,
  type LucideIcon,
} from "lucide-react";

/**
 * Owwy's icon set.
 *
 * Emoji used to stand in for icons throughout the app. They render as a
 * different typeface on every platform, carry skin tones and genders nobody
 * chose, sit on the text baseline rather than a grid, and can't take the
 * palette's colour — so a row of them never lines up and never matches. These
 * are drawn strokes at a fixed size that inherit `currentColor`.
 *
 * Ids are stable strings and are what gets stored. They are deliberately
 * descriptive rather than named after the drawing ("groceries", not "cart"),
 * so swapping the drawing later doesn't orphan anyone's data.
 */
export type IconName = string;

export const ICONS: Record<string, LucideIcon> = {
  // Money & accounts
  cash: Banknote,
  bank: Landmark,
  ewallet: Smartphone,
  savings: PiggyBank,
  emergency: LifeBuoy,
  credit: CreditCard,
  investment: TrendingUp,
  wallet: Wallet,
  coins: Coins,
  interest: Percent,
  insurance: ShieldCheck,
  taxes: Receipt,
  debt: Scale,
  salary: Cash2,
  payday: CalendarClock,

  // Eating & drinking
  food: Utensils,
  coffee: Coffee,
  soup: Soup,
  dessert: Cake,
  drinks: Beer,
  salad: Salad,
  fruit: Apple,
  meat: Beef,
  dairy: Milk,

  // Shopping
  groceries: ShoppingCart,
  shopping: ShoppingBag,
  store: Store,
  clothes: Shirt,
  shoes: Footprints,
  beauty: Sparkles,
  gift: Gift,
  tag: Tag,

  // Getting around
  transport: Car,
  fuel: Fuel,
  bus: Bus,
  train: TrainFront,
  bike: Bike,
  travel: Plane,
  parking: ParkingCircle,
  toll: Route,

  // Home & bills
  housing: House,
  utilities: Lightbulb,
  water: Droplets,
  gas: Flame,
  internet: Globe,
  wifi: Wifi,
  phone: Phone,
  subscriptions: Tv,
  rent: KeyRound,
  furniture: Sofa,
  repairs: Hammer,
  tools: Wrench,

  // People & care
  family: Users,
  baby: Baby,
  dog: Dog,
  cat: Cat,
  health: HeartPulse,
  medicine: Pill,
  doctor: Stethoscope,
  personal: Scissors,
  glasses: Glasses,

  // Learning, work, giving
  education: GraduationCap,
  books: BookOpen,
  work: Laptop,
  business: Briefcase,
  giving: Handshake,
  church: Church,
  benefits: Bank2,

  // Doing things
  entertainment: Gamepad2,
  movies: Clapperboard,
  music: Music,
  fitness: Dumbbell,
  hobby: Palette,
  photo: Camera,
  camping: Tent,
  ticket: Ticket,

  // Goals & catch-alls
  other: Package,
  growth: Sprout,
  recurring: RefreshCw,
  target: Target,
  trophy: Trophy,
  heart: Heart,
  star: Star,
  anchor: Anchor,
  compass: Compass,
  mountain: Mountain,
  waves: Waves,
  sun: Sun,
  moon: Moon,
  umbrella: Umbrella,
  leaf: Leaf,
  tree: TreePine,
  unknown: CircleHelp,
};

export const DEFAULT_ICON = "other";

/**
 * What the emoji that used to be stored should now draw.
 *
 * Nobody's data is migrated: a record still holding "🍔" keeps holding it and
 * simply renders as the food icon. That keeps backups, exports and the demo
 * set working untouched, and means an install from before this change looks
 * right the moment it loads.
 */
const LEGACY: Record<string, string> = {
  "🍔": "food", "☕": "coffee", "🍚": "soup", "🍜": "soup", "🍗": "meat", "🍕": "food",
  "🧋": "drinks", "🍰": "dessert", "🍺": "drinks", "🥗": "salad", "🍳": "food", "🍱": "food",
  "🛒": "groceries", "🛍️": "shopping", "🏪": "store", "👕": "clothes", "👟": "shoes",
  "💄": "beauty", "🧴": "beauty", "🧺": "personal", "🪴": "leaf", "🎁": "gift", "🏷️": "tag",
  "🚗": "transport", "⛽": "fuel", "🚌": "bus", "🚆": "train", "🛵": "bike", "🚲": "bike",
  "🚕": "transport", "✈️": "travel", "🅿️": "parking", "🛣️": "toll",
  "🏠": "housing", "💡": "utilities", "💧": "water", "🔥": "gas", "🌐": "internet",
  "📱": "ewallet", "📺": "subscriptions", "🔑": "rent", "🛋️": "furniture", "🧹": "personal", "🛠️": "tools",
  "👨‍👩‍👧": "family", "🧒": "baby", "🍼": "baby", "🐶": "dog", "🐱": "cat",
  "❤️": "health", "💊": "medicine", "🩺": "doctor", "🦷": "doctor", "👓": "glasses", "💇": "personal",
  "🎓": "education", "📚": "books", "💻": "work", "💼": "business", "🧾": "taxes",
  "💳": "credit", "🏦": "bank", "💰": "salary", "📈": "investment", "🤝": "giving",
  "🎮": "entertainment", "🎬": "movies", "🎵": "music", "⚽": "fitness", "🏋️": "fitness",
  "🧘": "fitness", "🎨": "hobby", "📷": "photo", "🎸": "music", "🏕️": "camping", "⛪": "church",
  "📦": "other", "✨": "growth", "🌱": "growth", "🔄": "recurring", "❓": "unknown",
  "💵": "cash", "🐷": "savings", "🛟": "emergency", "👛": "wallet",
  "🏝️": "travel", "🏛️": "benefits", "🛡️": "insurance", "↩️": "recurring", "🎉": "trophy",
  "🧭": "compass", "🪜": "target", "🔍": "compass",
};

/** The icon for a stored value, which may be an id or a legacy emoji. */
export function iconFor(value: string | undefined | null): LucideIcon {
  if (!value) return ICONS[DEFAULT_ICON];
  return ICONS[value] ?? ICONS[LEGACY[value] ?? ""] ?? ICONS[DEFAULT_ICON];
}

/** True when the value is one of ours rather than an emoji from before. */
export function isIconName(value: string | undefined | null): boolean {
  return Boolean(value && value in ICONS);
}

/** The picker's choices, in the order someone would look for them. */
export const ICON_CHOICES: string[] = [
  "food", "coffee", "soup", "dessert", "drinks", "salad", "fruit", "meat", "dairy",
  "groceries", "shopping", "store", "clothes", "shoes", "beauty", "gift", "tag",
  "transport", "fuel", "bus", "train", "bike", "travel", "parking", "toll",
  "housing", "utilities", "water", "gas", "internet", "wifi", "phone", "subscriptions",
  "rent", "furniture", "repairs", "tools",
  "family", "baby", "dog", "cat", "health", "medicine", "doctor", "personal", "glasses",
  "education", "books", "work", "business", "giving", "church", "benefits",
  "entertainment", "movies", "music", "fitness", "hobby", "photo", "camping", "ticket",
  "cash", "bank", "ewallet", "savings", "emergency", "credit", "investment", "wallet",
  "coins", "interest", "insurance", "taxes", "debt", "salary", "payday",
  "other", "growth", "recurring", "target", "trophy", "heart", "star",
  "anchor", "compass", "mountain", "waves", "sun", "moon", "umbrella", "leaf", "tree", "unknown",
];

/** A readable name for a screen reader and the picker's tooltip. */
export function iconLabel(name: string): string {
  return name.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}
