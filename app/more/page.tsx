"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/game";
import { AuthHeader } from "@/components/game";
import { BottomNav } from "@/components/game";
import { Button } from "@/components/ui/button";
import { BOTTOM_NAV_ITEMS } from "@/lib/config";
import { useAuth } from "@/hooks/use-auth";
import {
  IoPersonOutline,
  IoWalletOutline,
  IoTimeOutline,
  IoSettingsOutline,
  IoShieldCheckmarkOutline,
  IoHeadsetOutline,
  IoGiftOutline,
  IoTrophyOutline,
  IoDocumentTextOutline,
  IoInformationCircleOutline,
  IoChevronForward,
  IoHomeOutline,
  IoArrowDownCircleOutline,
  IoArrowUpCircleOutline,
  IoMenuOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

// Menu sections and items
const MENU_SECTIONS = [
  {
    title: "Account",
    items: [
      {
        id: "profile",
        label: "Profile",
        icon: <IoPersonOutline size={20} />,
        description: "View your profile",
        route: "/profile",
      },
      {
        id: "wallet",
        label: "Wallet",
        icon: <IoWalletOutline size={20} />,
        description: "Manage your funds",
        route: "/wallet",
      },
      {
        id: "history",
        label: "Transaction History",
        icon: <IoTimeOutline size={20} />,
        description: "View your transactions",
        route: "/history",
      },
    ],
  },
  {
    title: "Features",
    items: [
      {
        id: "vip",
        label: "VIP Club",
        icon: <IoTrophyOutline size={20} />,
        description: "Exclusive rewards and benefits",
        badge: "Gold",
        badgeColor: "#eab308",
        route: "/vip",
      },
      {
        id: "promotions",
        label: "Promotions",
        icon: <IoGiftOutline size={20} />,
        description: "View bonuses and offers",
        badge: "New",
        badgeColor: "#22c55e",
        route: "/promotions",
      },
    ],
  },
  {
    title: "Support & Legal",
    items: [
      {
        id: "support",
        label: "Help & Support",
        icon: <IoHeadsetOutline size={20} />,
        description: "FAQ and live chat",
        route: "/support",
      },
      {
        id: "kyc",
        label: "Verification",
        icon: <IoShieldCheckmarkOutline size={20} />,
        description: "KYC status and documents",
        route: "/kyc",
      },
      {
        id: "settings",
        label: "Settings",
        icon: <IoSettingsOutline size={20} />,
        description: "App preferences",
        route: "/settings",
      },
      {
        id: "terms",
        label: "Terms & Conditions",
        icon: <IoDocumentTextOutline size={20} />,
        description: "Legal information",
        route: "/terms",
      },
      {
        id: "about",
        label: "About",
        icon: <IoInformationCircleOutline size={20} />,
        description: "App version and info",
        route: "/about",
      },
    ],
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

export default function MorePage() {
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

  // Handle menu item click
  const handleMenuClick = (route: string) => {
    router.push(route);
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
        user={user || undefined}
        notificationCount={3}
        title="More"
      />

      <div className="px-5 py-7">
        {/* Page title */}
        <h1 className="text-2xl font-bold mb-2">More Options</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Explore additional features and settings
        </p>

        {/* Menu Sections */}
        {MENU_SECTIONS.map((section, sectionIndex) => (
          <section key={section.title} className={cn(sectionIndex > 0 && "mt-6")}>
            <h2 className="text-sm font-semibold text-foreground mb-3 px-1">
              {section.title}
            </h2>
            <div className="space-y-2">
              {section.items.map((item) => (
                <Button
                  key={item.id}
                  variant="outline"
                  onClick={() => handleMenuClick(item.route)}
                  className={cn(
                    "w-full justify-start h-auto p-4",
                    "gap-3"
                  )}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg bg-muted-foreground/10 flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {item.label}
                      </span>
                      {"badge" in item && item.badge && (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: `${"badgeColor" in item ? item.badgeColor : "#22c55e"}20`,
                            color: "badgeColor" in item ? item.badgeColor : "#22c55e",
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </p>
                  </div>

                  {/* Chevron */}
                  <IoChevronForward
                    className="text-muted-foreground flex-shrink-0"
                    size={18}
                  />
                </Button>
              ))}
            </div>
          </section>
        ))}

        {/* App Info Footer */}
        <footer className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Casino Platform v1.0.0
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Made with ❤️ for gaming
          </p>
        </footer>
      </div>

      <BottomNav items={NAV_ITEMS_WITH_ICONS} active="menu" onChange={handleNavigate} />
    </div>
  );
}
