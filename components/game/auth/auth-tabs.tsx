"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { tabTransition } from "@/components/lib/game-animations";

export type TabValue = string;

export interface AuthTabsProps {
  /**
   * Currently active tab value
   */
  value: TabValue;

  /**
   * Callback when tab changes
   */
  onValueChange: (value: TabValue) => void;

  /**
   * Tab configuration
   */
  tabs: Array<{
    value: TabValue;
    label: string;
  }>;

  /**
   * Tab panel content
   */
  children: React.ReactNode;

  /**
   * Container class name
   */
  className?: string;
}

/**
 * Authentication tabs with animated underline
 * Extends shadcn Tabs with custom styling
 * Focused purely on tab navigation (no header/close button)
 *
 * @example
 * ```tsx
 * const [tab, setTab] = useState<TabValue>("signin");
 *
 * <AuthTabs
 *   value={tab}
 *   onValueChange={setTab}
 *   tabs={[
 *     { value: "signin", label: "Sign In" },
 *     { value: "signup", label: "Sign Up" }
 *   ]}
 * >
 *   <TabsContent value="signin">
 *     <SignInPanel />
 *   </TabsContent>
 *   <TabsContent value="signup">
 *     <SignUpPanel />
 *   </TabsContent>
 * </AuthTabs>
 * ```
 */
const AuthTabs = React.forwardRef<HTMLDivElement, AuthTabsProps>(
  ({ value, onValueChange, tabs, children, className }, ref) => {
    return (
      <Tabs
        ref={ref}
        value={value}
        onValueChange={onValueChange}
        className={cn("w-full", className)}
      >
        {/* Tab list with animated underline */}
        <div
          className={cn(
            "flex items-center",
            "bg-background border-b border-border",
            "px-5"
          )}
        >
          <TabsList
            className={cn(
              "flex gap-0 h-auto bg-transparent border-0 p-0 rounded-none flex-1"
            )}
          >
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  "relative flex-1 py-3.5 px-0",
                  "bg-transparent border-0",
                  "text-muted-foreground font-semibold text-sm",
                  "hover:text-foreground transition-colors duration-200",
                  "data-[state=active]:text-foreground",
                  "focus-visible:ring-0 focus-visible:outline-none",
                  "rounded-none"
                )}
              >
                {tab.label}
                {value === tab.value && (
                  <motion.div
                    layoutId="tab-underline"
                    className={cn(
                      "absolute bottom-0 left-0 right-0",
                      "h-[2px] bg-primary",
                      "rounded-t-sm"
                    )}
                    transition={tabTransition}
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {children}
      </Tabs>
    );
  }
);

AuthTabs.displayName = "AuthTabs";

export { AuthTabs };
