"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MethodCardProps {
  /**
   * Display name of the payment method (e.g., "Bitcoin", "Ethereum", "Credit Card")
   */
  name: string;

  /**
   * Icon or logo to display for the method
   */
  icon: React.ReactNode;

  /**
   * Optional fee information to display
   */
  fee?: string;

  /**
   * Optional estimated processing time
   */
  estimatedTime?: string;

  /**
   * Optional badge text for promotions or special features
   */
  badge?: string;

  /**
   * Callback when the card is clicked
   */
  onClick?: () => void;

  /**
   * Whether this method is currently selected
   */
  selected?: boolean;

  /**
   * Whether the card should be disabled
   */
  disabled?: boolean;

  /**
   * Additional CSS classes for customization
   */
  className?: string;
}

/**
 * MethodCard - A selectable card for payment/withdrawal methods
 *
 * Used on deposit and withdrawal pages to let users choose their preferred
 * payment method. Supports selection state, fee display, and promotional badges.
 */
export function MethodCard({
  name,
  icon,
  fee,
  estimatedTime,
  badge,
  onClick,
  selected = false,
  disabled = false,
  className,
}: MethodCardProps) {
  return (
    <Card
      onClick={disabled ? undefined : onClick}
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all duration-200",
        "hover:shadow-lg active:scale-[0.98]",
        selected && "ring-2 ring-primary shadow-primary/20",
        disabled && "opacity-50 cursor-not-allowed hover:shadow-none",
        className
      )}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-3 right-3 z-10">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <svg
              className="w-3 h-3 text-primary-foreground"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Badge */}
      {badge && (
        <div className="absolute top-0 left-0 bg-gradient-to-r from-primary to-primary/70 text-primary-foreground text-xs font-semibold px-2 py-1 rounded-br-lg">
          {badge}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
            {typeof icon === "string" ? (
              <img src={icon} alt={name} className="w-8 h-8 object-contain" />
            ) : (
              <div className="text-2xl">{icon}</div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{name}</h3>

            {(fee || estimatedTime) && (
              <div className="mt-1 space-y-0.5">
                {fee && (
                  <p className="text-xs text-muted-foreground">
                    Fee: <span className="text-foreground font-medium">{fee}</span>
                  </p>
                )}
                {estimatedTime && (
                  <p className="text-xs text-muted-foreground">
                    ⏱ {estimatedTime}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom accent for selected state */}
      {selected && (
        <div className="h-1 bg-primary rounded-b-lg" />
      )}
    </Card>
  );
}
