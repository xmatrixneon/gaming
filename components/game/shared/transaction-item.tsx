"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type TransactionStatus = "pending" | "completed" | "failed" | "processing";

export interface TransactionItemProps {
  /**
   * Transaction type
   */
  type: "deposit" | "withdrawal";

  /**
   * Amount with currency
   */
  amount: string;

  /**
   * Currency symbol or code
   */
  currency: string;

  /**
   * Transaction status
   */
  status?: TransactionStatus;

  /**
   * Date/time of transaction
   */
  date: string;

  /**
   * Transaction ID or reference
   */
  txId?: string;

  /**
   * Icon or emoji to display
   */
  icon?: React.ReactNode;

  /**
   * Click handler (for viewing details)
   */
  onClick?: () => void;

  /**
   * Card class name
   */
  className?: string;
}

/**
 * Transaction list item
 * Displays deposit/withdrawal transaction with status
 *
 * @example
 * ```tsx
 * <TransactionItem
 *   type="deposit"
 *   amount="0.5"
 *   currency="BTC"
 *   status="completed"
 *   date="2024-01-15 14:30"
 *   icon="📥"
 * />
 * ```
 */
const TransactionItem = React.forwardRef<HTMLDivElement, TransactionItemProps>(
  (
    {
      type,
      amount,
      currency,
      status = "pending",
      date,
      txId,
      icon,
      onClick,
      className,
    },
    ref
  ) => {
    // Status colors
    const statusColors = {
      pending: "text-yellow-500",
      completed: "text-green-500",
      failed: "text-destructive",
      processing: "text-blue-500",
    };

    // Status icons (optional)
    const statusIcons = {
      pending: "⏳",
      completed: "✓",
      failed: "✗",
      processing: "⏳",
    };

    return (
      <Card
        onClick={onClick}
        className={cn(
          "overflow-hidden cursor-pointer rounded-lg p-4",
          "bg-muted border border-border",
          "flex items-center gap-4",
          "transition-colors duration-200",
          "hover:border-primary/50",
          className
        )}
      >
        {/* Type Icon */}
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0",
            type === "deposit" ? "bg-green-500/10" : "bg-red-500/10"
          )}
        >
          {icon || (type === "deposit" ? "📥" : "📤")}
        </div>

        {/* Transaction Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("font-bold text-foreground")}>
              {type === "deposit" ? "+" : "-"}
              {amount} {currency}
            </span>
            {txId && (
              <span className="text-xs text-muted-foreground truncate" title={txId}>
                • {txId.slice(0, 8)}...
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{date}</div>
        </div>

        {/* Status */}
        <div
          className={cn(
            "flex-shrink-0",
            "text-sm font-medium",
            statusColors[status]
          )}
        >
          {statusIcons[status]}
        </div>
      </Card>
    );
  }
);

TransactionItem.displayName = "TransactionItem";

export { TransactionItem };
