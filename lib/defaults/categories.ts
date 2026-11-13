import type { Category } from "@/types/models";

type CategorySeed = Omit<Category, "order" | "isDefault" | "archived">;

/**
 * Default categories. Stable ids let smart input, demo data and budgets refer
 * to them; users can rename, recolor, archive, or add their own.
 * Keywords cover common international terms plus everyday Philippine merchants.
 */
const EXPENSE: CategorySeed[] = [
  {
    id: "cat_food",
    name: "Food",
    emoji: "🍔",
    color: "#E8A33D",
    kind: "expense",
    discretionary: true,
    keywords: [
      "food", "lunch", "dinner", "breakfast", "brunch", "merienda", "snack", "snacks", "coffee", "cafe", "latte",
      "tea", "milktea", "boba", "restaurant", "meal", "eat", "eating", "pizza", "burger", "burgers", "chicken", "ramen",
      "sushi", "bakery", "bread", "donut", "dessert", "drinks", "beer", "takeout", "delivery", "foodpanda",
      "grabfood", "jollibee", "mcdo", "mcdonalds", "kfc", "chowking", "mang inasal", "starbucks", "dunkin",
      "tim hortons", "shakeys", "greenwich", "carinderia", "turo-turo", "street food", "kwek-kwek",
    ],
  },
  {
    id: "cat_groceries",
    name: "Groceries",
    emoji: "🛒",
    color: "#6E8B3D",
    kind: "expense",
    discretionary: false,
    keywords: [
      "groceries", "grocery", "supermarket", "market", "palengke", "wet market", "sm", "sm supermarket",
      "puregold", "robinsons supermarket", "savemore", "landers", "s&r", "costco", "walmart", "tesco", "aldi",
      "rice", "vegetables", "fruits", "meat", "fish", "eggs", "milk", "sari-sari", "7-eleven", "7eleven", "alfamart",
    ],
  },
  {
    id: "cat_transport",
    name: "Transport",
    emoji: "🚗",
    color: "#3C6E8F",
    kind: "expense",
    discretionary: false,
    keywords: [
      "transport", "transportation", "grab", "uber", "lyft", "taxi", "cab", "jeep", "jeepney", "tricycle", "trike",
      "bus", "mrt", "lrt", "train", "metro", "subway", "fare", "gas", "gasoline", "fuel", "diesel", "petrol",
      "parking", "toll", "autosweep", "easytrip", "angkas", "joyride", "move it", "commute", "beep", "shell", "petron",
      "caltex",
    ],
  },
  {
    id: "cat_housing",
    name: "Housing",
    emoji: "🏠",
    color: "#8E6C4A",
    kind: "expense",
    discretionary: false,
    keywords: ["rent", "housing", "mortgage", "condo", "apartment", "dorm", "boarding house", "association dues", "hoa", "home repair"],
  },
  {
    id: "cat_utilities",
    name: "Utilities",
    emoji: "💡",
    color: "#D9A21B",
    kind: "expense",
    discretionary: false,
    keywords: [
      "utilities", "electricity", "electric", "meralco", "power", "water", "maynilad", "manila water", "internet",
      "wifi", "pldt", "globe", "smart", "converge", "dito", "load", "phone bill", "postpaid", "gas bill", "lpg",
    ],
  },
  {
    id: "cat_subscriptions",
    name: "Subscriptions",
    emoji: "📱",
    color: "#7A5AA6",
    kind: "expense",
    discretionary: true,
    keywords: [
      "subscription", "subscriptions", "netflix", "spotify", "youtube premium", "disney", "disney+", "hbo", "max",
      "prime video", "apple music", "icloud", "google one", "chatgpt", "canva", "adobe", "viu", "iwant", "patreon",
    ],
  },
  {
    id: "cat_education",
    name: "Education",
    emoji: "🎓",
    color: "#3A7D7A",
    kind: "expense",
    discretionary: false,
    keywords: ["tuition", "school", "education", "books", "book", "course", "class", "seminar", "training", "school supplies", "udemy", "coursera"],
  },
  {
    id: "cat_health",
    name: "Health",
    emoji: "❤️",
    color: "#C8483B",
    kind: "expense",
    discretionary: false,
    keywords: [
      "health", "medicine", "meds", "pharmacy", "mercury drug", "watsons", "doctor", "checkup", "check-up", "hospital",
      "clinic", "dentist", "dental", "vitamins", "gym", "fitness", "hmo", "philhealth", "insurance", "therapy", "lab test",
    ],
  },
  {
    id: "cat_shopping",
    name: "Shopping",
    emoji: "🛍️",
    color: "#D0668A",
    kind: "expense",
    discretionary: true,
    keywords: [
      "shopping", "shopee", "lazada", "zalora", "amazon", "clothes", "shoes", "shirt", "dress", "uniqlo", "h&m",
      "zara", "mall", "gadget", "gadgets", "electronics", "makeup", "skincare", "gift", "gifts", "home decor", "ikea",
    ],
  },
  {
    id: "cat_entertainment",
    name: "Entertainment",
    emoji: "🎮",
    color: "#5B7BD5",
    kind: "expense",
    discretionary: true,
    keywords: ["movie", "movies", "cinema", "concert", "game", "games", "gaming", "steam", "playstation", "xbox", "nintendo", "karaoke", "videoke", "bar", "party", "hobby", "entertainment"],
  },
  {
    id: "cat_travel",
    name: "Travel",
    emoji: "✈️",
    color: "#2F8FA3",
    kind: "expense",
    discretionary: true,
    keywords: ["travel", "trip", "flight", "flights", "airfare", "hotel", "airbnb", "resort", "vacation", "cebu pacific", "philippine airlines", "airasia", "booking", "agoda", "tour", "baggage"],
  },
  {
    id: "cat_family",
    name: "Family",
    emoji: "👨‍👩‍👧",
    color: "#B5835A",
    kind: "expense",
    discretionary: false,
    keywords: ["family", "parents", "padala", "remittance", "allowance for", "kids", "baby", "diapers", "daycare", "nanny", "yaya", "pet", "pets", "vet"],
  },
  {
    id: "cat_debt",
    name: "Debt",
    emoji: "💳",
    color: "#6B5B53",
    kind: "expense",
    discretionary: false,
    keywords: ["loan", "debt", "installment", "amortization", "credit card payment", "cc payment", "home credit", "billease", "atome", "sss loan", "pag-ibig loan"],
  },
  {
    id: "cat_other",
    name: "Other",
    emoji: "📦",
    color: "#8A9491",
    kind: "expense",
    discretionary: true,
    keywords: ["misc", "miscellaneous", "other", "fee", "fees", "donation", "church", "tithe", "haircut", "laundry"],
  },
];

const INCOME: CategorySeed[] = [
  {
    id: "cat_salary",
    name: "Salary",
    emoji: "💰",
    color: "#1F8A5B",
    kind: "income",
    discretionary: false,
    keywords: ["salary", "payroll", "paycheck", "pay", "wage", "wages", "sweldo", "13th month", "bonus"],
  },
  {
    id: "cat_freelance",
    name: "Freelance",
    emoji: "💼",
    color: "#2E7D6B",
    kind: "income",
    discretionary: false,
    keywords: ["freelance", "client", "invoice", "project", "commission", "gig", "side hustle", "raket", "upwork", "fiverr"],
  },
  {
    id: "cat_business",
    name: "Business",
    emoji: "🏪",
    color: "#4F8A3D",
    kind: "income",
    discretionary: false,
    keywords: ["sales", "business", "store", "revenue", "profit", "orders"],
  },
  {
    id: "cat_allowance",
    name: "Allowance",
    emoji: "🎁",
    color: "#7FA650",
    kind: "income",
    discretionary: false,
    keywords: ["allowance", "baon", "gift money", "ayuda", "stipend", "remittance received"],
  },
  {
    id: "cat_interest",
    name: "Interest",
    emoji: "🌱",
    color: "#3F8F6B",
    kind: "income",
    discretionary: false,
    keywords: ["interest", "interest earned", "dividend", "dividends", "yield"],
  },
  {
    id: "cat_income_other",
    name: "Other income",
    emoji: "✨",
    color: "#5FA8A0",
    kind: "income",
    discretionary: false,
    keywords: ["refund", "cashback", "reimbursement", "sold", "income", "received"],
  },
];

export const INTEREST_CATEGORY_ID = "cat_interest";

export const DEFAULT_CATEGORIES: Category[] = [...EXPENSE, ...INCOME].map((c, i) => ({
  ...c,
  order: i,
  isDefault: true,
  archived: false,
}));

export const FALLBACK_EXPENSE_CATEGORY_ID = "cat_other";
export const FALLBACK_INCOME_CATEGORY_ID = "cat_income_other";
export const DEBT_CATEGORY_ID = "cat_debt";

/** Ordered by how often a category of that kind actually gets made. */
export const CATEGORY_EMOJI_CHOICES = [
  // Eating & drinking
  "🍔", "☕", "🍚", "🍜", "🍗", "🍕", "🧋", "🍰", "🍺", "🥗", "🍳", "🍱",
  // Shopping & groceries
  "🛒", "🛍️", "🏪", "👕", "👟", "💄", "🧴", "🧺", "🪴", "🎁",
  // Getting around
  "🚗", "⛽", "🚌", "🚆", "🛵", "🚲", "🚕", "✈️", "🅿️", "🛣️",
  // Home & bills
  "🏠", "💡", "💧", "🔥", "🌐", "📱", "📺", "🔑", "🛋️", "🧹", "🛠️",
  // People & care
  "👨‍👩‍👧", "🧒", "🍼", "🐶", "🐱", "❤️", "💊", "🩺", "🦷", "👓", "💇",
  // Learning, work, money
  "🎓", "📚", "💻", "💼", "🧾", "💳", "🏦", "💰", "📈", "🤝",
  // Doing things
  "🎮", "🎬", "🎵", "⚽", "🏋️", "🧘", "🎨", "📷", "🎸", "🏕️", "⛪",
  // Catch-alls
  "📦", "✨", "🌱", "🔄", "❓",
];

export const CATEGORY_COLORS = [
  "#E8A33D", "#6E8B3D", "#3C6E8F", "#8E6C4A", "#D9A21B", "#7A5AA6", "#3A7D7A", "#C8483B",
  "#D0668A", "#5B7BD5", "#2F8FA3", "#B5835A", "#6B5B53", "#1F8A5B", "#8A9491",
];
