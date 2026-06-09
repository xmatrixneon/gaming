"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/game";
import { AuthButton } from "@/components/game/auth";
import { GradientCard, BalanceCard } from "@/components/game/shared";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/game";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  const [avatarError, setAvatarError] = useState(false);

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
    avatar: authUser.image || "",
    memberSince: authUser.createdAt ? new Date(authUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : "Recent",
    vipLevel: authUser.vipLevel || "Bronze",
    phoneNumber: authUser.phoneNumber,
    phoneNumberVerified: authUser.phoneNumberVerified || false,
    balance: authUser.balance || "0",
  };

  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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
      badgeVariant: (userProfile.phoneNumberVerified ? "default" : "secondary") as "default" | "secondary",
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

  // VIP badge color mapping
  const getVIPBadgeVariant = (level: string) => {
    switch (level.toLowerCase()) {
      case "gold":
        return "default";
      case "platinum":
        return "default";
      case "silver":
        return "secondary";
      case "bronze":
      default:
        return "outline";
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

      <div className="px-4 py-6 sm:px-5 sm:py-7">
        {/* User Profile Card */}
        <Card className="mb-6">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-4">
              {/* Avatar with improved display */}
              <div className="relative">
                <Avatar size="xl" className="ring-4 ring-background/50">
                  {userProfile.avatar && !avatarError ? (
                    <AvatarImage
                      src={userProfile.avatar}
                      alt={userProfile.username}
                      onError={() => setAvatarError(true)}
                    />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-bold">
                    {getInitials(userProfile.username)}
                  </AvatarFallback>
                </Avatar>
                {/* VIP Badge on avatar */}
                <div className="absolute -bottom-1 -right-1">
                  <Badge variant={getVIPBadgeVariant(userProfile.vipLevel)} className="text-[10px] px-1.5 py-0">
                    {userProfile.vipLevel.slice(0, 2).toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold truncate">{userProfile.username}</h1>
                </div>
                <p className="text-sm text-muted-foreground truncate">{userProfile.email}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    Since {userProfile.memberSince}
                  </p>
                  {userProfile.phoneNumber && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        {userProfile.phoneNumber}
                        {userProfile.phoneNumberVerified && (
                          <IoShieldCheckmarkOutline className="text-green-500" size={12} />
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Verification Status */}
            {userProfile.phoneNumberVerified && (
              <div className="mt-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <IoShieldCheckmarkOutline className="text-green-500" size={16} />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    Verified Phone Number
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Balance Overview */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 px-1">
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

        <Separator className="mb-6" />

        {/* Quick Actions - Responsive Grid */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 px-1">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

        <Separator className="mb-6" />

        {/* Account Menu */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 px-1">
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
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    {item.badge && (
                      <Badge variant={item.badgeVariant} className="text-[10px]">
                        {item.badge}
                      </Badge>
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

        <Separator className="mb-6" />

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
