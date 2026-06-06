"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CategoryTab {
  /**
   * Unique identifier for the category
   */
  id: string;

  /**
   * Display label
   */
  label: string;

  /**
   * Icon component (accepts LucideIcon, react-icons, or any component with size/className props)
   */
  icon: React.ComponentType<{ size?: number; className?: string }>;

  /**
   * Optional click handler
   */
  onClick?: () => void;
}

export interface CategoryTabsProps {
  /**
   * Array of category tabs
   */
  categories: CategoryTab[];

  /**
   * Currently active category ID
   */
  active: string;

  /**
   * Callback when category changes
   */
  onChange: (id: string) => void;

  /**
   * Container class name
   */
  className?: string;

  /**
   * Button class name
   */
  buttonClassName?: string;
}

/**
 * Game category navigation tabs
 * Extends tab pattern with game platform styling
 *
 * @example
 * ```tsx
 * const [activeTab, setActiveTab] = useState("casino");
 *
 * const categories = [
 *   { id: "casino", label: "Casino", icon: Dices },
 *   { id: "sports", label: "Sports", icon: Trophy },
 *   { id: "slots", label: "Slots", icon: Gamepad2 },
 *   { id: "live", label: "Live", icon: Zap }
 * ];
 *
 * <CategoryTabs
 *   categories={categories}
 *   active={activeTab}
 *   onChange={setActiveTab}
 * />
 * ```
 */
const CategoryTabs = React.forwardRef<HTMLDivElement, CategoryTabsProps>(
  ({ categories, active, onChange, className, buttonClassName }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex gap-1.5 overflow-x-auto pb-1",
          "scrollbar-hide",
          className
        )}
      >
        {categories.map((category) => {
          const Icon = category.icon;
          const isActive = active === category.id;

          return (
            <button
              key={category.id}
              onClick={() => {
                onChange(category.id);
                category.onClick?.();
              }}
              className={cn(
                // Layout
                "flex items-center gap-1.5 whitespace-nowrap",
                "px-4 py-2 rounded-lg",
                // Typography
                "font-bold text-sm tracking-wide",
                // Base transition
                "transition-all duration-200",
                // Active state
                isActive
                  ? "bg-primary text-primary-foreground border-primary border"
                  : "bg-muted text-muted-foreground border-border border",
                // Hover state (only when inactive)
                !isActive &&
                  "hover:bg-muted/80 hover:border-border/80",
                // Focus
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                buttonClassName
              )}
            >
              <Icon size={14} className="flex-shrink-0" />
              <span>{category.label}</span>
            </button>
          );
        })}
      </div>
    );
  }
);
CategoryTabs.displayName = "CategoryTabs";

export { CategoryTabs };
