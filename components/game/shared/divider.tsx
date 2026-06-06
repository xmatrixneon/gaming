"use client";

import * as React from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface DividerProps extends React.ComponentProps<typeof Separator> {
  /**
   * Text to display in the center of the divider
   */
  text?: string;

  /**
   * Text class name
   */
  textClassName?: string;
}

/**
 * Divider with centered text
 * Extends shadcn Separator with text variant
 *
 * @example
 * ```tsx
 * // With text
 * <Divider text="Log in directly with" />
 *
 * // Without text (plain divider)
 * <Divider />
 *
 * // With custom styling
 * <Divider text="OR" textClassName="text-xs font-bold" />
 * ```
 */
const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ text, className, textClassName, orientation = "horizontal", ...props }, ref) => {
    if (text) {
      return (
        <div
          ref={ref}
          className={cn("flex items-center gap-3", className)}
          {...props}
        >
          <Separator
            orientation={orientation}
            className={cn(
              "flex-1 bg-border",
              orientation === "horizontal" ? "h-[1px]" : "w-[1px] h-full"
            )}
          />
          <span
            className={cn(
              "text-muted-foreground text-xs font-medium whitespace-nowrap",
              textClassName
            )}
          >
            {text}
          </span>
          <Separator
            orientation={orientation}
            className={cn(
              "flex-1 bg-border",
              orientation === "horizontal" ? "h-[1px]" : "w-[1px] h-full"
            )}
          />
        </div>
      );
    }

    return (
      <Separator
        ref={ref}
        orientation={orientation}
        className={cn("bg-border", className)}
        {...props}
      />
    );
  }
);
Divider.displayName = "Divider";

export { Divider };
