"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface NavItem {
  /**
   * Icon component (accepts LucideIcon, react-icons, or any component with size/className props)
   */
  icon: React.ComponentType<{ size?: number; className?: string }>;

  /**
   * Label text
   */
  label: string;

  /**
   * Unique identifier
   */
  id: string;

  /**
   * Optional click handler
   */
  onClick?: () => void;

  /**
   * Show notification badge
   */
  badge?: boolean;
}

export interface BottomNavProps {
  /**
   * Array of navigation items (usually 5 items)
   */
  items: NavItem[];

  /**
   * Currently active item id
   */
  active: string;

  /**
   * Callback when active item changes
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
 * Mobile bottom navigation bar
 * Fixed positioning with 5-item grid layout
 *
 * @example
 * ```tsx
 * const [activeNav, setActiveNav] = useState("casino");
 *
 * const navItems = [
 *   { id: "menu", icon: Menu, label: "Menu" },
 *   { id: "explore", icon: Search, label: "Explore" },
 *   { id: "casino", icon: Dices, label: "Casino" },
 *   { id: "sports", icon: Trophy, label: "Sports" },
 *   { id: "chat", icon: Users, label: "Chat", badge: true }
 * ];
 *
 * <BottomNav
 *   items={navItems}
 *   active={activeNav}
 *   onChange={setActiveNav}
 * />
 * ```
 */
const BottomNav = React.forwardRef<HTMLDivElement, BottomNavProps>(
  ({ items, active, onChange, className, buttonClassName }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          "max-w-md mx-auto",
          "bg-muted border-t border-border",
          "bottom-nav-safe",
          "no-scrollbar",
          className
        )}
      >
        <div
          className={cn(
            "flex items-center justify-around",
            "py-2 px-1",
            "max-w-md mx-auto"
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onChange(item.id);
                  item.onClick?.();
                }}
                className={cn(
                  "flex flex-col items-center gap-1",
                  "flex-1 max-w-16",
                  "py-1",
                  "transition-all duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  buttonClassName
                )}
              >
                <div className="relative">
                  <Icon
                    size={18}
                    className={cn(
                      "transition-colors duration-150",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  {item.badge && (
                    <span
                      className={cn(
                        "absolute -top-1 -right-1",
                        "w-2 h-2 rounded-full",
                        "bg-red-500"
                      )}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold tracking-wide",
                    "transition-colors duration-150",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);
BottomNav.displayName = "BottomNav";

export { BottomNav };
