import { AppHeader } from "@/components/game";
import { cn } from "@/lib/utils";

export default function DepositLoading() {
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
        isAuthenticated={true}
        notificationCount={0}
      />

      <div className={cn("px-4 pt-4")}>
        {/* Skeleton Balance Card */}
        <div
          className={cn(
            "h-28 bg-muted rounded-xl animate-pulse mb-6"
          )}
        />

        {/* Skeleton Categories */}
        <div className={cn("mb-6")}>
          <div
            className={cn("h-6 bg-muted rounded w-32 animate-pulse mb-3")}
          />
          <div className={cn("grid grid-cols-2 gap-3")}>
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-24 bg-muted rounded-lg animate-pulse"
                )}
              />
            ))}
          </div>
        </div>

        {/* Skeleton Recent Transactions */}
        <div>
          <div
            className={cn("h-6 bg-muted rounded w-40 animate-pulse mb-3")}
          />
          <div className={cn("space-y-2")}>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={cn("h-16 bg-muted rounded-lg animate-pulse")}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
