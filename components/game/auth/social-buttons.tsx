"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { AuthButton } from "./auth-button";
import { cn } from "@/lib/utils";

export interface SocialProvider {
  /**
   * Provider name/label
   */
  name: string;

  /**
   * Icon component or emoji
   */
  icon: React.ReactNode;

  /**
   * Optional custom color (for icons that need specific colors)
   */
  color?: string;

  /**
   * Click handler
   */
  onClick?: () => void;

  /**
   * Disabled state
   */
  disabled?: boolean;
}

export interface SocialButtonsProps {
  /**
   * Layout variant for the buttons
   * - full: Full-width buttons stacked vertically
   * - "icon-grid": Grid of icon-only buttons
   * - three-col: Three-column grid with text labels
   */
  layout: "full" | "icon-grid" | "three-col";

  /**
   * Array of social providers
   */
  providers: SocialProvider[];

  /**
   * Container class name
   */
  className?: string;

  /**
   * Button class name applied to all buttons
   */
  buttonClassName?: string;

  /**
   * Show "More" dropdown button in three-col layout
   */
  showMore?: boolean;

  /**
   * Callback when "More" is clicked
   */
  onMoreClick?: () => void;
}

/**
 * Social authentication button layouts
 * Supports full-width, icon grid, and three-column layouts
 *
 * @example
 * ```tsx
 * // Full-width layout
 * <SocialButtons
 *   layout="full"
 *   providers={[
 *     { name: "Cwallet", icon: "🐢" },
 *     { name: "Passkey", icon: <RiUserShared2Line size={18} /> }
 *   ]}
 * />
 *
 * // Icon grid layout
 * <SocialButtons
 *   layout="icon-grid"
 *   providers={[
 *     { name: "Google", icon: <FaGoogle size={16} color="#EA4335" /> },
 *     { name: "Twitter", icon: <FaXTwitter size={16} /> }
 *   ]}
 * />
 *
 * // Three-column layout
 * <SocialButtons
 *   layout="three-col"
 *   providers={[
 *     { name: "Cwallet", icon: "🐢" },
 *     { name: "Google", icon: <FcGoogle size={15} /> }
 *   ]}
 *   showMore
 *   onMoreClick={() => {}}
 * />
 * ```
 */
const SocialButtons = React.forwardRef<HTMLDivElement, SocialButtonsProps>(
  (
    {
      layout,
      providers,
      className,
      buttonClassName,
      showMore = false,
      onMoreClick,
    },
    ref
  ) => {
    // Full-width layout - stacked buttons
    if (layout === "full") {
      return (
        <div
          ref={ref}
          className={cn("flex flex-col gap-2.5", className)}
        >
          {providers.map((provider, index) => (
            <AuthButton
              key={provider.name + index}
              variant="social"
              className={cn("w-full", buttonClassName)}
              icon={
                <span
                  className="flex-shrink-0"
                  style={provider.color ? { color: provider.color } : undefined}
                >
                  {provider.icon}
                </span>
              }
              onClick={provider.onClick}
              disabled={provider.disabled}
            >
              <span className="font-bold text-base">
                {provider.name}
              </span>
            </AuthButton>
          ))}
        </div>
      );
    }

    // Icon grid layout - responsive grid
    if (layout === "icon-grid") {
      return (
        <div
          ref={ref}
          className={cn(
            "flex gap-2 justify-center",
            "grid grid-cols-7 sm:grid-cols-7 md:grid-cols-7",
            className
          )}
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))" }}
        >
          {providers.map((provider, index) => (
            <AuthButton
              key={provider.name + index}
              variant="social-icon"
              className={cn("flex-1", buttonClassName)}
              icon={
                <span
                  className="flex-shrink-0"
                  style={provider.color ? { color: provider.color } : undefined}
                >
                  {provider.icon}
                </span>
              }
              onClick={provider.onClick}
              disabled={provider.disabled}
            />
          ))}
        </div>
      );
    }

    // Three-column layout - fixed 3-column grid
    if (layout === "three-col") {
      const displayProviders = showMore
        ? providers.slice(0, 2)
        : providers.slice(0, 3);

      return (
        <div
          ref={ref}
          className={cn(
            "grid grid-cols-3 gap-2.5",
            className
          )}
        >
          {displayProviders.map((provider, index) => (
            <AuthButton
              key={provider.name + index}
              variant="social"
              className={cn(
                "rounded-lg text-sm",
                "gap-1.5",
                buttonClassName
              )}
              icon={
                <span
                  className="flex-shrink-0 text-base"
                  style={provider.color ? { color: provider.color } : undefined}
                >
                  {provider.icon}
                </span>
              }
              onClick={provider.onClick}
              disabled={provider.disabled}
            >
              <span className="font-bold text-sm">
                {provider.name}
              </span>
            </AuthButton>
          ))}
          {showMore && (
            <AuthButton
              variant="social"
              className={cn("rounded-lg", buttonClassName)}
              onClick={onMoreClick}
            >
              <span className="font-semibold text-xs">More</span>
              <ChevronDown size={11} className="text-muted-foreground" />
            </AuthButton>
          )}
        </div>
      );
    }

    return null;
  }
);
SocialButtons.displayName = "SocialButtons";

export { SocialButtons };
