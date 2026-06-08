import { AppHeader } from "@/components/game";
import { cn } from "@/lib/utils";
import { IoPersonOutline } from "react-icons/io5";

export default function ProfileLoading() {
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
        {/* Skeleton Header */}
        <div className={cn("flex items-center gap-4 mb-6")}>
          <div
            className={cn(
              "w-16 h-16 rounded-full",
              "bg-muted animate-pulse"
            )}
          />
          <div className={cn("flex-1 space-y-2")}>
            <div
              className={cn("h-5 bg-muted rounded animate-pulse")}
            />
            <div
              className={cn("h-4 bg-muted rounded w-2/3 animate-pulse")}
            />
          </div>
        </div>

        {/* Skeleton Balance Card */}
        <div
          className={cn(
            "h-24 bg-muted rounded-xl animate-pulse mb-6"
          )}
        />

        {/* Skeleton Menu Items */}
        <div className={cn("space-y-3")}>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-14 bg-muted rounded-lg animate-pulse",
                "delay-" + (i * 100)
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
