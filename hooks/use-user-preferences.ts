"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getUserPreferences,
  saveUserPreferences,
  UserPreferences,
  DEFAULT_USER_PREFERENCES,
  formatCurrency,
  formatUserCurrency,
  getCurrentCurrency,
  getCurrentLocale,
} from "@/lib/config";

/**
 * Hook for managing user preferences (locale, currency, theme)
 *
 * @example
 * const { preferences, updatePreferences, formatCurrency } = useUserPreferences();
 *
 * // Change currency to INR
 * updatePreferences({ currency: "INR" });
 *
 * // Format amount with current currency
 * const formatted = formatCurrency(12458.50); // "₹12,458.50" if currency is INR
 */
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(
    DEFAULT_USER_PREFERENCES
  );
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const loaded = getUserPreferences();
    setPreferences(loaded);
    setIsLoaded(true);
  }, []);

  /**
   * Update user preferences
   */
  const updatePreferences = useCallback(
    (updates: Partial<UserPreferences>) => {
      const updated = { ...preferences, ...updates };
      setPreferences(updated);
      saveUserPreferences(updates);
    },
    [preferences]
  );

  /**
   * Set currency
   */
  const setCurrency = useCallback(
    (currency: UserPreferences["currency"]) => {
      updatePreferences({ currency });
    },
    [updatePreferences]
  );

  /**
   * Set locale
   */
  const setLocale = useCallback(
    (locale: UserPreferences["locale"]) => {
      updatePreferences({ locale });
    },
    [updatePreferences]
  );

  /**
   * Set theme
   */
  const setTheme = useCallback(
    (theme: UserPreferences["theme"]) => {
      updatePreferences({ theme });
    },
    [updatePreferences]
  );

  /**
   * Format amount with user's preferred currency
   */
  const formatAmount = useCallback(
    (amount: number | string) => {
      return formatUserCurrency(amount);
    },
    [preferences.currency]
  );

  /**
   * Format amount with specific currency (override user preference)
   */
  const formatAmountWithCurrency = useCallback(
    (amount: number | string, currency: UserPreferences["currency"]) => {
      return formatCurrency(amount, currency);
    },
    []
  );

  return {
    preferences,
    isLoaded,
    updatePreferences,
    setCurrency,
    setLocale,
    setTheme,
    formatCurrency: formatAmount,
    formatCurrencyWith: formatAmountWithCurrency,
    getCurrentCurrency: () => preferences.currency,
    getCurrentLocale: () => preferences.locale,
  };
}
