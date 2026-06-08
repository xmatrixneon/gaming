"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/game";
import { BottomNav } from "@/components/game";
import { BOTTOM_NAV_ITEMS } from "@/lib/config";
import { useAuth } from "@/hooks/use-auth";
import {
  IoWalletOutline,
  IoQrCodeOutline,
  IoHomeOutline,
  IoArrowDownCircleOutline,
  IoArrowUpCircleOutline,
  IoPersonOutline,
  IoMenuOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

// Payment categories - simplified to 2 main options
const PAYMENT_CATEGORIES = [
  {
    id: "upi",
    name: "UPI Payment",
    icon: <IoQrCodeOutline />,
    description: "Google Pay, Paytm, PhonePe + more",
    gatewayUrl: process.env.NEXT_PUBLIC_UPI_GATEWAY_URL || "#",
  },
  {
    id: "crypto",
    name: "Crypto",
    icon: <IoWalletOutline />,
    description: "USDT, BTC, ETH + more",
    gatewayUrl: process.env.NEXT_PUBLIC_CRYPTO_GATEWAY_URL || "#",
  },
];

// Bottom navigation items
const NAV_ITEMS = [
  { id: "home", icon: IoHomeOutline, label: "Home" },
  { id: "deposit", icon: IoArrowDownCircleOutline, label: "Deposit" },
  { id: "withdraw", icon: IoArrowUpCircleOutline, label: "Withdraw" },
  { id: "profile", icon: IoPersonOutline, label: "Profile" },
  { id: "menu", icon: IoMenuOutline, label: "More" },
];

export default function DepositPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  // Map icon names to actual icon components for bottom nav
  const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    home: IoHomeOutline,
    deposit: IoArrowDownCircleOutline,
    withdraw: IoArrowUpCircleOutline,
    profile: IoPersonOutline,
    menu: IoMenuOutline,
  };

  // Bottom navigation items with icons
  const NAV_ITEMS_WITH_ICONS = BOTTOM_NAV_ITEMS.map((item) => ({
    id: item.id,
    icon: NAV_ICONS[item.id],
    label: item.label,
  }));

  // Handle navigation
  const handleNavigate = (itemId: string) => {
    const navItem = BOTTOM_NAV_ITEMS.find((item) => item.id === itemId);
    if (navItem) {
      router.push(navItem.route);
    }
  };

  // Handle category card click - redirect to payment gateway
  const handleCategoryClick = (category: typeof PAYMENT_CATEGORIES[0]) => {
    if (category.gatewayUrl && category.gatewayUrl !== "#") {
      window.open(category.gatewayUrl, "_blank");
    } else {
      // Fallback: show alert if gateway URL not configured
      alert("Payment gateway URL not configured. Please contact support.");
    }
  };

  return (
    <div
      className={cn(
        "min-h-screen",
        "bg-background",
        "text-foreground",
        "max-w-md mx-auto",
        "pb-safe-nav"
      )}
    >
      <AppHeader
        isAuthenticated={isAuthenticated}
        user={user ? {
          username: user.username,
          avatar: user.image,
          balance: user.balance ? parseFloat(user.balance) : 0,
          vipLevel: user.vipLevel,
        } : undefined}
        notificationCount={2}
        title="Deposit"
      />

      <div className="px-5 py-7">
        {/* Page title */}
        <h1 className="text-2xl font-bold mb-2">Deposit Funds</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Choose your preferred deposit method
        </p>

        {/* Payment Categories - Two Horizontal Cards */}
        <section className="mb-6">
          <div className="grid grid-cols-2 gap-3">
            {PAYMENT_CATEGORIES.map((category) => (
              <div
                key={category.id}
                onClick={() => handleCategoryClick(category)}
                className={cn(
                  "relative overflow-hidden rounded-xl border-2",
                  "bg-card hover:bg-accent/50",
                  "transition-all duration-200",
                  "cursor-pointer",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  "p-4 flex flex-col items-center justify-center",
                  "min-h-[160px] text-center"
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "text-4xl mb-3",
                  category.id === "upi" ? "text-green-500" : "text-orange-500"
                )}>
                  {category.icon}
                </div>

                {/* Name */}
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {category.name}
                </h3>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {category.description}
                </p>

                {/* Arrow indicator */}
                <div className="absolute top-3 right-3 text-muted-foreground/50">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Info Section */}
        <section className="mt-8 p-4 bg-muted/30 rounded-lg border border-border/50">
          <p className="text-xs text-muted-foreground text-center">
            💡 You'll be redirected to our secure payment gateway to complete your deposit
          </p>
        </section>
      </div>

      <BottomNav items={NAV_ITEMS_WITH_ICONS} active="deposit" onChange={handleNavigate} />
    </div>
  );
}
