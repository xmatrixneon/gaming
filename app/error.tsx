"use client";

import * as React from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/game";
import {
  IoAlertCircleOutline,
  IoHomeOutline,
  IoReloadOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service
    console.error("Application error:", error);
  }, [error, unstable_retry]);

  return (
    <div
      className={cn(
        "min-h-screen relative overflow-hidden",
        "bg-background",
        "text-foreground",
        "max-w-md mx-auto",
        "pb-safe-nav"
      )}
    >
      <AppHeader
        isAuthenticated={false}
        notificationCount={0}
      />

      <div className={cn("flex flex-col items-center justify-center px-6 pt-20")}>
        {/* Error Icon */}
        <div
          className={cn(
            "w-20 h-20 rounded-full",
            "bg-destructive/10",
            "flex items-center justify-center",
            "mb-6"
          )}
        >
          <IoAlertCircleOutline
            size={40}
            className="text-destructive"
          />
        </div>

        {/* Error Message */}
        <h1
          className={cn(
            "text-2xl font-bold",
            "text-foreground",
            "mb-2"
          )}
        >
          Oops! Something went wrong
        </h1>
        <p
          className={cn(
            "text-sm text-muted-foreground",
            "text-center",
            "mb-8"
          )}
        >
          We encountered an unexpected error. Don't worry, your data is safe.
        </p>

        {/* Action Buttons */}
        <div className={cn("flex gap-3 w-full")}>
          <Button
            variant="outline"
            className={cn("flex-1")}
            onClick={() => window.location.href = "/"}
          >
            <IoHomeOutline size={18} />
            <span className="ml-2">Go Home</span>
          </Button>
          <Button
            className={cn("flex-1")}
            onClick={unstable_retry}
          >
            <IoReloadOutline size={18} />
            <span className="ml-2">Try Again</span>
          </Button>
        </div>

        {/* Error Details (Debug) */}
        {process.env.NODE_ENV === "development" && (
          <details
            className={cn(
              "mt-8 p-4 rounded-lg",
              "bg-muted/50",
              "w-full"
            )}
          >
            <summary className={cn("text-sm font-semibold cursor-pointer")}>
              Error Details
            </summary>
            <pre className={cn("mt-2 text-xs overflow-auto")}>
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
