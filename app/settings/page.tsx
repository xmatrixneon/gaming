"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { AuthHeader } from "@/components/game";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/game";
import { BOTTOM_NAV_ITEMS } from "@/lib/config";
import { useAuth } from "@/hooks/use-auth";
import {
  IoKeyOutline,
  IoPersonOutline,
  IoNotificationsOutline,
  IoShieldCheckmarkOutline,
  IoChevronForward,
  IoHomeOutline,
  IoArrowDownCircleOutline,
  IoArrowUpCircleOutline,
  IoPersonOutline as IoProfileIcon,
  IoMenuOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

// Type for password menu item (which has dynamic label/description)
interface PasswordMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  route: string;
}

// Settings menu items (excluding change/set password - added dynamically)
const SETTINGS_MENU_BASE = [
  {
    id: "account-info",
    label: "Account Information",
    icon: <IoPersonOutline size={18} />,
    description: "View and edit your personal details",
    route: "/settings/account-info",
    disabled: true,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: <IoNotificationsOutline size={18} />,
    description: "Manage your notification preferences",
    route: "/settings/notifications",
    disabled: true,
  },
  {
    id: "security",
    label: "Security",
    icon: <IoShieldCheckmarkOutline size={18} />,
    description: "Two-factor authentication, login history",
    route: "/settings/security",
    disabled: true,
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, user: authUser, isLoading: authLoading, hasPassword, isAccountsLoading } = useAuth();

  // Build dynamic settings menu with password item (must be before early returns for React Hooks)
  const settingsMenu = useMemo(() => {
    const passwordItem = {
      id: hasPassword ? "change-password" : "set-password",
      label: hasPassword ? "Change Password" : "Set Password",
      icon: <IoKeyOutline size={18} />,
      description: hasPassword
        ? "Update your account password"
        : "Add password authentication to your account",
      route: hasPassword ? "/settings/change-password" : "/settings/set-password",
    };

    return [passwordItem, ...SETTINGS_MENU_BASE];
  }, [hasPassword]);

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !authUser)) {
      router.push("/signin");
    }
  }, [isAuthenticated, authUser, authLoading, router]);

  // Handle loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground max-w-md mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  // Don't render anything while redirecting
  if (!isAuthenticated || !authUser) {
    return null;
  }

  // Handle navigation
  const handleNavigate = (itemId: string) => {
    const navItem = BOTTOM_NAV_ITEMS.find((item) => item.id === itemId);
    if (navItem) {
      router.push(navItem.route);
    }
  };

  // Handle settings menu clicks
  const handleSettingsMenu = (item: typeof SETTINGS_MENU_BASE[0] | PasswordMenuItem) => {
    if ('disabled' in item && item.disabled) return;
    router.push(item.route);
  };

  // Map icon names to actual icon components for bottom nav
  const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    home: IoHomeOutline,
    deposit: IoArrowDownCircleOutline,
    withdraw: IoArrowUpCircleOutline,
    profile: IoProfileIcon,
    menu: IoMenuOutline,
  };

  // Bottom navigation items with icons
  const NAV_ITEMS_WITH_ICONS = BOTTOM_NAV_ITEMS.map((item) => ({
    id: item.id,
    icon: NAV_ICONS[item.id],
    label: item.label,
  }));

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
      <AuthHeader
        onClose={() => router.push("/profile")}
        title="Settings"
      />

      <div className="px-5 py-7">
        {/* Header */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </motion.div>

        {/* Settings Menu */}
        <motion.section
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {isAccountsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            settingsMenu.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Button
                  variant="outline"
                  onClick={() => handleSettingsMenu(item)}
                  disabled={'disabled' in item ? (item.disabled as boolean) : false}
                  className={cn(
                    "w-full justify-start h-auto p-4",
                    "gap-3",
                    (('disabled' in item && item.disabled) ? "opacity-50 cursor-not-allowed" : undefined)
                  )}
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg bg-muted-foreground/10 flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {item.label}
                      </span>
                      {'disabled' in item && item.disabled ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Coming Soon
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>

                  {/* Chevron */}
                  <IoChevronForward
                    className="text-muted-foreground flex-shrink-0"
                    size={18}
                  />
                </Button>
              </motion.div>
            ))
          )}
        </motion.section>
      </div>

      <BottomNav items={NAV_ITEMS_WITH_ICONS} active="profile" onChange={handleNavigate} />
    </div>
  );
}
