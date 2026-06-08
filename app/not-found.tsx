import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/game";
import {
  IoHomeOutline,
  IoSearchOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

export default function NotFound() {
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
        {/* 404 Graphic */}
        <div className={cn("relative mb-8")}>
          <div
            className={cn(
              "w-32 h-32 rounded-full",
              "bg-muted/50",
              "flex items-center justify-center",
              "border-8 border-border"
            )}
          >
            <span className={cn("text-6xl font-bold text-muted-foreground")}>
              404
            </span>
          </div>
        </div>

        {/* Not Found Message */}
        <h1
          className={cn(
            "text-2xl font-bold",
            "text-foreground",
            "mb-2"
          )}
        >
          Page not found
        </h1>
        <p
          className={cn(
            "text-sm text-muted-foreground",
            "text-center",
            "mb-8"
          )}
        >
          Sorry, we couldn't find the page you're looking for.
        </p>

        {/* Action Buttons */}
        <div className={cn("flex gap-3 w-full")}>
          <Link href="/" className={cn("flex-1")}>
            <Button variant="outline" className={cn("w-full")}>
              <IoHomeOutline size={18} />
              <span className="ml-2">Go Home</span>
            </Button>
          </Link>
          <Link href="/more" className={cn("flex-1")}>
            <Button className={cn("w-full")}>
              <IoSearchOutline size={18} />
              <span className="ml-2">Browse Games</span>
            </Button>
          </Link>
        </div>

        {/* Helpful Links */}
        <div className={cn("mt-12 w-full")}>
          <h3 className={cn("text-sm font-semibold mb-4")}>
            Popular Pages
          </h3>
          <ul className={cn("space-y-2")}>
            <Link
              href="/"
              className={cn(
                "block text-sm text-muted-foreground",
                "hover:text-foreground",
                "transition-colors"
              )}
            >
              Home
            </Link>
            <Link
              href="/deposit"
              className={cn(
                "block text-sm text-muted-foreground",
                "hover:text-foreground",
                "transition-colors"
              )}
            >
              Deposit
            </Link>
            <Link
              href="/more"
              className={cn(
                "block text-sm text-muted-foreground",
                "hover:text-foreground",
                "transition-colors"
              )}
            >
              More Options
            </Link>
          </ul>
        </div>
      </div>
    </div>
  );
}
