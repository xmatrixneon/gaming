/**
 * Shared configuration for the casino platform
 * Includes navigation, currency settings, and i18n locale configuration
 */

// ============================================================================
// NAVIGATION CONFIGURATION
// ============================================================================

export interface NavItem {
  id: string;
  label: string;
  route: string;
}

/**
 * Standard bottom navigation items used across all pages
 * Consistent navigation: Home, Deposit, Withdraw, Profile, More
 */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", route: "/" },
  { id: "deposit", label: "Deposit", route: "/deposit" },
  { id: "withdraw", label: "Withdraw", route: "/withdraw" },
  { id: "profile", label: "Profile", route: "/profile" },
  { id: "menu", label: "More", route: "/more" },
];

/**
 * Get the active navigation item based on current path
 */
export function getActiveNav(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname === "/deposit") return "deposit";
  if (pathname === "/withdraw") return "withdraw";
  if (pathname === "/profile") return "profile";
  if (pathname === "/more" || pathname.startsWith("/more")) return "menu";
  return "home"; // default
}

// ============================================================================
// CURRENCY CONFIGURATION
// ============================================================================

export type CurrencyCode = "USD" | "INR" | "EUR" | "BTC" | "ETH" | "USDT" | "USDC" | "SOL";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  position: "before" | "after";
  decimals: number;
  thousandsSeparator: string;
  decimalSeparator: string;
}

/**
 * Supported currencies with their formatting rules
 */
export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: {
    code: "USD",
    symbol: "$",
    position: "before",
    decimals: 2,
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
  INR: {
    code: "INR",
    symbol: "₹",
    position: "before",
    decimals: 2,
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    position: "before",
    decimals: 2,
    thousandsSeparator: ".",
    decimalSeparator: ",",
  },
  BTC: {
    code: "BTC",
    symbol: "₿",
    position: "after",
    decimals: 8,
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
  ETH: {
    code: "ETH",
    symbol: "Ξ",
    position: "after",
    decimals: 6,
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
  USDT: {
    code: "USDT",
    symbol: "₮",
    position: "after",
    decimals: 2,
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
  USDC: {
    code: "USDC",
    symbol: "$",
    position: "before",
    decimals: 2,
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
  SOL: {
    code: "SOL",
    symbol: "◎",
    position: "after",
    decimals: 4,
    thousandsSeparator: ",",
    decimalSeparator: ".",
  },
};

/**
 * Default currency (can be overridden by user preference)
 */
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

/**
 * Format currency amount according to currency config
 *
 * @param amount - The amount to format
 * @param currencyCode - The currency code (defaults to DEFAULT_CURRENCY)
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(12458.50, "USD") // "$12,458.50"
 * formatCurrency(12458.50, "INR") // "₹12,458.50"
 * formatCurrency(0.5, "BTC") // "0.50000000 ₿"
 */
export function formatCurrency(
  amount: number | string,
  currencyCode: CurrencyCode = DEFAULT_CURRENCY
): string {
  const config = CURRENCIES[currencyCode];
  if (!config) {
    console.warn(`Unknown currency code: ${currencyCode}`);
    return String(amount);
  }

  // Convert to number if string
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return String(amount);
  }

  // Format number with proper separators
  const parts = numAmount.toFixed(config.decimals).split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1] || "";

  // Add thousands separator
  const formattedInteger = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    config.thousandsSeparator
  );

  // Build formatted string
  let formatted = "";
  if (config.decimals > 0) {
    formatted = `${formattedInteger}${config.decimalSeparator}${decimalPart}`;
  } else {
    formatted = formattedInteger;
  }

  // Add symbol
  if (config.position === "before") {
    return `${config.symbol}${formatted}`;
  } else {
    return `${formatted} ${config.symbol}`;
  }
}

/**
 * Parse currency string back to number
 *
 * @param formatted - Formatted currency string
 * @param currencyCode - The currency code
 * @returns Parsed number
 */
export function parseCurrency(
  formatted: string,
  currencyCode: CurrencyCode = DEFAULT_CURRENCY
): number {
  const config = CURRENCIES[currencyCode];
  if (!config) return 0;

  // Remove symbol
  let cleaned = formatted.replace(config.symbol, "").trim();

  // Remove thousands separator
  cleaned = cleaned.replace(new RegExp(`\\${config.thousandsSeparator}`, "g"), "");

  // Replace decimal separator with dot for parsing
  cleaned = cleaned.replace(config.decimalSeparator, ".");

  return parseFloat(cleaned) || 0;
}

// ============================================================================
// LOCALE / I18N CONFIGURATION
// ============================================================================

export type LocaleCode = "en" | "hi" | "es" | "pt" | "zh" | "ja" | "ko" | "de" | "fr";

export interface LocaleConfig {
  code: LocaleCode;
  name: string;
  nativeName: string;
  currencyCode: CurrencyCode;
  dateFormat: string;
  timeFormat: "12h" | "24h";
}

/**
 * Supported locales with their configurations
 */
export const LOCALES: Record<LocaleCode, LocaleConfig> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    currencyCode: "USD",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "12h",
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिंदी",
    currencyCode: "INR",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12h",
  },
  es: {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    currencyCode: "EUR",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
  },
  pt: {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    currencyCode: "USD",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
  },
  zh: {
    code: "zh",
    name: "Chinese",
    nativeName: "中文",
    currencyCode: "USD",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "24h",
  },
  ja: {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    currencyCode: "USD",
    dateFormat: "YYYY/MM/DD",
    timeFormat: "24h",
  },
  ko: {
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
    currencyCode: "USD",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "24h",
  },
  de: {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    currencyCode: "EUR",
    dateFormat: "DD.MM.YYYY",
    timeFormat: "24h",
  },
  fr: {
    code: "fr",
    name: "French",
    nativeName: "Français",
    currencyCode: "EUR",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "24h",
  },
};

/**
 * Default locale
 */
export const DEFAULT_LOCALE: LocaleCode = "en";

/**
 * Get locale configuration
 */
export function getLocale(code: LocaleCode = DEFAULT_LOCALE): LocaleConfig {
  return LOCALES[code] || LOCALES[DEFAULT_LOCALE];
}

/**
 * Get currency code for a locale
 */
export function getCurrencyForLocale(locale: LocaleCode): CurrencyCode {
  return getLocale(locale).currencyCode;
}

// ============================================================================
// USER PREFERENCES (Default values - would come from user profile in production)
// ============================================================================

export interface UserPreferences {
  locale: LocaleCode;
  currency: CurrencyCode;
  theme: "light" | "dark" | "system";
}

/**
 * Default user preferences
 */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  locale: DEFAULT_LOCALE,
  currency: DEFAULT_CURRENCY,
  theme: "system",
};

/**
 * Get user preferences (would load from user profile/database in production)
 * For now, returns defaults
 */
export function getUserPreferences(): UserPreferences {
  // TODO: Load from user profile, local storage, or database
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("user_preferences");
    if (stored) {
      try {
        return { ...DEFAULT_USER_PREFERENCES, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_USER_PREFERENCES;
      }
    }
  }
  return DEFAULT_USER_PREFERENCES;
}

/**
 * Save user preferences
 */
export function saveUserPreferences(preferences: Partial<UserPreferences>): void {
  const current = getUserPreferences();
  const updated = { ...current, ...preferences };

  if (typeof window !== "undefined") {
    localStorage.setItem("user_preferences", JSON.stringify(updated));
  }
}

/**
 * Get current user's currency code
 */
export function getCurrentCurrency(): CurrencyCode {
  return getUserPreferences().currency;
}

/**
 * Get current user's locale
 */
export function getCurrentLocale(): LocaleCode {
  return getUserPreferences().locale;
}

/**
 * Format amount using user's preferred currency
 */
export function formatUserCurrency(amount: number | string): string {
  return formatCurrency(amount, getCurrentCurrency());
}
