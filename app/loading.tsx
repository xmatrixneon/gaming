"use client";

import { AppHeader } from "@/components/game";
import { cn } from "@/lib/utils";
import { IoGameControllerOutline } from "react-icons/io5";

export default function Loading() {
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
        {/* Loading Animation */}
        <div className={cn("relative mb-8")}>
          <div
            className={cn(
              "w-20 h-20 rounded-full",
              "bg-primary/10",
              "flex items-center justify-center",
              "animate-pulse"
            )}
          >
            <IoGameControllerOutline
              size={40}
              className="text-primary animate-spin-slow"
            />
          </div>
          <div
            className={cn(
              "absolute inset-0 rounded-full",
              "border-2 border-primary/20",
              "animate-ping"
            )}
          />
        </div>

        {/* Loading Text */}
        <h2
          className={cn(
            "text-lg font-semibold",
            "text-foreground",
            "mb-2"
          )}
        >
          Loading your experience
        </h2>
        <p className={cn("text-sm text-muted-foreground")}>
          Please wait while we get everything ready...
        </p>
      </div>

      <style jsx>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
