"use client";

import * as React from "react";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { chevronRotate, chevronTransition } from "@/components/lib/game-animations";

export interface CollapsibleFieldProps {
  /**
   * Label for the collapsible trigger
   */
  label: string;

  /**
   * Open state (controlled)
   */
  open: boolean;

  /**
   * Callback when open state changes
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Content to show when expanded
   */
  children?: React.ReactNode;

  /**
   * Placeholder text for the input (if using default input)
   */
  placeholder?: string;

  /**
   * Custom input element (replaces default input)
   */
  input?: React.ReactNode;

  /**
   * Container class name
   */
  className?: string;

  /**
   * Input container class name
   */
  inputClassName?: string;
}

/**
 * Collapsible field with chevron animation
 * Used for referral/promo code sections
 *
 * @example
 * ```tsx
 * const [promoOpen, setPromoOpen] = useState(false);
 *
 * <CollapsibleField
 *   label="Enter Referral / Promo Code (Optional)"
 *   open={promoOpen}
 *   onOpenChange={setPromoOpen}
 *   placeholder="Referral / Promo Code"
 * />
 * ```
 */
const CollapsibleField = React.forwardRef<
  HTMLDivElement,
  CollapsibleFieldProps
>(
  (
    {
      label,
      open,
      onOpenChange,
      children,
      placeholder,
      input,
      className,
      inputClassName,
    },
    ref
  ) => {
    return (
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <div ref={ref} className={cn("space-y-2", className)}>
          {/* Trigger row */}
          <CollapsibleTrigger
            className={cn(
              "w-full flex items-center justify-between",
              "bg-muted border border-border",
              "px-4 py-3.5 rounded-lg",
              "transition-colors duration-200",
              "hover:bg-muted/80 hover:border-border/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "cursor-pointer"
            )}
          >
            <span
              className={cn(
                "text-sm",
                "text-muted-foreground",
                "font-medium"
              )}
            >
              {label}
            </span>
            <motion.div
              animate={open ? "open" : "closed"}
              variants={chevronRotate}
              transition={chevronTransition}
            >
              <ChevronDown
                size={13}
                strokeWidth={2}
                className="text-muted-foreground"
              />
            </motion.div>
          </CollapsibleTrigger>

          {/* Collapsible content */}
          <CollapsibleContent className="space-y-2">
            {children || (
              <>
                {input || (
                  <input
                    type="text"
                    placeholder={placeholder}
                    className={cn(
                      "w-full h-12",
                      "bg-muted border border-[1.5px]",
                      "px-4 text-foreground placeholder:text-muted-foreground",
                      "rounded-lg",
                      "focus:border-primary focus:ring-ring",
                      "focus-visible:outline-none",
                      "transition-colors duration-200",
                      inputClassName
                    )}
                  />
                )}
              </>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }
);
CollapsibleField.displayName = "CollapsibleField";

export { CollapsibleField };
