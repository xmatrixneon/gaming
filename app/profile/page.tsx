"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppHeader } from "@/components/game";
import { AuthHeader } from "@/components/game";
import { AuthButton } from "@/components/game/auth";
import { GradientCard, BalanceCard } from "@/components/game/shared";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/game";
import { BOTTOM_NAV_ITEMS, formatUserCurrency } from "@/lib/config";
import { useAuth } from "@/hooks/use-auth";
import {
  IoPersonOutline,
  IoSettingsOutline,
  IoShieldCheckmarkOutline,
  IoCardOutline,
  IoTimeOutline,
  IoHeadsetOutline,
  IoChevronForward,
  IoLogOutOutline,
  IoWalletOutline,
  IoArrowUpCircleOutline,
  IoArrowDownCircleOutline,
  IoHomeOutline,
  IoMenuOutline,
  IoTrophyOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

// Quick action items
const QUICK_ACTIONS = [
  {
    id: "deposit",
    label: "Deposit",
    icon: IoArrowDownCircleOutline,
    emoji: "📥",
    color: "from-green-500/20 to-green-600/20",
    glow: "#22c55e",
  },
  {
    id: "withdraw",
    label: "Withdraw",
    icon: IoArrowUpCircleOutline,
    emoji: "📤",
    color: "from-red-500/20 to-red-600/20",
    glow: "#ef4444",
  },
  {
    id: "history",
    label: "History",
    icon: IoTimeOutline,
    emoji: "📋",
    color: "from-blue-500/20 to-blue-600/20",
    glow: "#3b82f6",
  },
  {
    id: "vip",
    label: "VIP Club",
    icon: IoTrophyOutline,
    emoji: "👑",
    color: "from-yellow-500/20 to-yellow-600/20",
    glow: "#eab308",
  },
];

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, user: authUser, isLoading: authLoading, signOut } = useAuth();

  // Redirect to signin if not authenticated (useEffect to avoid setState during render)
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
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Don't render anything while redirecting
  if (!isAuthenticated || !authUser) {
    return null;
  }

  // Format user data from Better Auth session
  const userProfile = {
    username: authUser.username || authUser.email?.split('@')[0] || "Player",
    email: authUser.email || "",
    avatar: authUser.image || "🎮",
    memberSince: authUser.createdAt ? new Date(authUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "Recent",
    vipLevel: authUser.vipLevel || "Bronze",
    phoneNumber: authUser.phoneNumber,
    phoneNumberVerified: authUser.phoneNumberVerified || false,
    balance: authUser.balance || "0",
  };

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

  // Handle quick action clicks
  const handleQuickAction = (actionId: string) => {
    switch (actionId) {
      case "deposit":
        router.push("/deposit");
        break;
      case "withdraw":
        router.push("/withdraw");
        break;
      case "history":
        router.push("/history");
        break;
      case "vip":
        router.push("/vip");
        break;
      default:
        break;
    }
  };

  // Handle account menu clicks
  const handleAccountMenu = (menuId: string) => {
    switch (menuId) {
      case "settings":
        router.push("/settings");
        break;
      case "kyc":
        router.push("/kyc");
        break;
      case "payment-methods":
        router.push("/payment-methods");
        break;
      case "support":
        router.push("/support");
        break;
      default:
        break;
    }
  };

  // Account menu items with real user data
  const ACCOUNT_MENU = [
    {
      id: "settings",
      label: "Account Settings",
      icon: <IoSettingsOutline size={18} />,
      description: "Personal info, security, preferences",
    },
    {
      id: "kyc",
      label: "Verification",
      icon: <IoShieldCheckmarkOutline size={18} />,
      description: userProfile.phoneNumberVerified ? "Phone verified" : "Verify your phone",
      badge: userProfile.phoneNumberVerified ? "Verified" : "Pending",
      badgeColor: userProfile.phoneNumberVerified ? "#22c55e" : "#eab308",
    },
    {
      id: "payment-methods",
      label: "Payment Methods",
      icon: <IoCardOutline size={18} />,
      description: "Manage your payment options",
    },
    {
      id: "support",
      label: "Help & Support",
      icon: <IoHeadsetOutline size={18} />,
      description: "FAQ, live chat, contact us",
    },
  ];

  // Handle logout
  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out?")) {
      try {
        await signOut();
        router.push("/signin");
      } catch (error) {
        console.error("Logout failed:", error);
        // Still redirect even if logout fails
        router.push("/signin");
      }
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
        user={authUser ? {
          username: authUser.username || authUser.email?.split('@')[0] || "Player",
          avatar: authUser.image || userProfile.avatar,
          balance: parseFloat(authUser.balance || "0"),
          vipLevel: authUser.vipLevel || "Bronze",
        } : undefined}
        notificationCount={5}
        title="Profile"
      />

      <div className="px-5 py-7">
        {/* User Profile Header */}
        <section className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-3xl shadow-lg">
              {userProfile.avatar}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold">{userProfile.username}</h1>
                {/* VIP Badge */}
                <span className={cn(
                  "px-2 py-0.5 text-xs font-semibold rounded-full border",
                  userProfile.vipLevel === "Gold" && "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
                  userProfile.vipLevel === "Silver" && "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30",
                  userProfile.vipLevel === "Bronze" && "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30",
                  userProfile.vipLevel === "Platinum" && "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30"
                )}>
                  {userProfile.vipLevel}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{userProfile.email}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-muted-foreground">
                  Member since {userProfile.memberSince}
                </p>
                {userProfile.phoneNumber && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <p className="text-xs text-muted-foreground">
                      {userProfile.phoneNumber} {userProfile.phoneNumberVerified && "✓"}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Verification Status */}
          {userProfile.phoneNumberVerified && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
              <IoShieldCheckmarkOutline className="text-green-500" size={16} />
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                Verified Phone Number
              </span>
            </div>
          )}
        </section>

        {/* Balance Overview */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Your Balances
          </h2>
          <div className="space-y-2.5">
            <BalanceCard
              currency="USD"
              balance={formatUserCurrency(parseFloat(userProfile.balance || "0"))}
              icon="$"
              subtitle="Total Balance"
            />
            <BalanceCard
              currency="Bonus"
              balance={formatUserCurrency(0)}
              icon="🎁"
              subtitle="Available Bonus"
            />
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {QUICK_ACTIONS.map((action) => (
              <GradientCard
                key={action.id}
                label={action.label}
                icon={action.icon}
                emoji={action.emoji}
                gradient={action.color}
                glow={action.glow}
                subtitle="Go"
                onClick={() => handleQuickAction(action.id)}
              />
            ))}
          </div>
        </section>

        {/* Account Menu */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Account
          </h2>
          <div className="space-y-2">
            {ACCOUNT_MENU.map((item) => (
              <Button
                key={item.id}
                variant="outline"
                onClick={() => handleAccountMenu(item.id)}
                className={cn(
                  "w-full justify-start h-auto p-4",
                  "gap-3"
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
                    {item.badge && (
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${item.badgeColor}20`,
                          color: item.badgeColor,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
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
            ))}
          </div>
        </section>

        {/* Logout Button */}
        <AuthButton
          variant="secondary"
          onClick={handleLogout}
          className="w-full"
        >
          <IoLogOutOutline size={18} />
          <span>Log Out</span>
        </AuthButton>
      </div>

      <BottomNav items={NAV_ITEMS_WITH_ICONS} active="profile" onChange={handleNavigate} />
    </div>
  );
}
