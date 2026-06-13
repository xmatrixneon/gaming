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
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AuthInput } from "@/components/game/auth/auth-input";
import { BOTTOM_NAV_ITEMS, formatUserCurrency } from "@/lib/config";
import { formatPaisa } from "@/lib/format-currency";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  IoPersonOutline,
  IoSettingsOutline,
  IoShieldCheckmarkOutline,
  IoTimeOutline,
  IoHeadsetOutline,
  IoChevronForward,
  IoLogOutOutline,
  IoArrowUpCircleOutline,
  IoArrowDownCircleOutline,
  IoHomeOutline,
  IoMenuOutline,
  IoTrophyOutline,
  IoCopyOutline,
  IoShareOutline,
  IoGiftOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoLockClosedOutline,
  IoCardOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";


export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, user: authUser, isLoading: authLoading, signOut } = useAuth();
  const [avatarError, setAvatarError] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Fetch referral data
  const { data: referralData } = api.referral.getReferralCode.useQuery();
  const { data: referralStats } = api.referral.getReferralStats.useQuery();

  // Change password mutation
  const changePassword = api.auth.changePassword.useMutation();

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


  // Handle copy referral code
  const handleCopyReferral = () => {
    if (referralData?.shareLink) {
      navigator.clipboard.writeText(referralData.shareLink);
      setCopiedReferral(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopiedReferral(false), 2000);
    }
  };

  // Handle share referral
  const handleShareReferral = async () => {
    if (referralData?.shareLink && navigator.share) {
      try {
        await navigator.share({
          title: 'Join ClausBet',
          text: 'Use my referral link to sign up and get bonuses!',
          url: referralData.shareLink,
        });
      } catch (err) {
        console.log('Share failed:', err);
      }
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    setIsChangingPassword(true);

    try {
      const result = await changePassword.mutateAsync({
        currentPassword,
        newPassword,
      });

      if (result.success) {
        toast.success("Password changed successfully");
        setShowPasswordForm(false);
        setCurrentPassword("");
        setNewPassword("");
      } else {
        toast.error(result.error || "Failed to change password");
      }
    } catch (error) {
      console.error("[PROFILE] Password change failed:", error);
      const message = error instanceof Error ? error.message : "Failed to change password";
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out?")) {
      try {
        await signOut();
        router.push("/signin");
      } catch (error) {
        console.error("Logout failed:", error);
        router.push("/signin");
      }
    }
  };

  // VIP badge color mapping
  const getVIPBadgeVariant = (level: string) => {
    switch (level.toLowerCase()) {
      case "gold":
      case "platinum":
        return "default";
      case "silver":
        return "secondary";
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
              {/* Avatar */}
              <div className="relative">
                <Avatar className="ring-4 ring-background/50 h-16 w-16">
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
                {/* VIP Badge */}
                <div className="absolute -bottom-1 -right-1">
                  <Badge variant={getVIPBadgeVariant(userProfile.vipLevel)} className="text-[10px] px-1.5 py-0">
                    {userProfile.vipLevel.slice(0, 2).toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold truncate">{userProfile.username}</h1>
                <p className="text-sm text-muted-foreground truncate">{userProfile.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Member since {userProfile.memberSince}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Refer & Earn Card */}
        {referralData?.referralCode && (
          <Card className="mb-6">
            <CardContent className="p-4">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                    <IoGiftOutline className="text-foreground" size={15} />
                  </div>
                  <span className="text-sm font-semibold">Refer &amp; Earn</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-0 px-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => router.push("/referral")}
                >
                  View All →
                </Button>
              </div>

              {/* Code row */}
              <div className="flex items-center justify-between bg-muted rounded-md px-3 py-2.5 mb-3 border border-border">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                    Your Code
                  </p>
                  <p className="text-base font-bold tracking-[0.2em]">
                    {referralData.referralCode}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleCopyReferral}
                  >
                    <IoCopyOutline size={13} className="mr-1" />
                    {copiedReferral ? "Copied!" : "Copy"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={handleShareReferral}
                  >
                    <IoShareOutline size={13} className="mr-1" />
                    Share
                  </Button>
                </div>
              </div>

              {/* Stats row */}
              {referralStats && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted rounded-md p-2 text-center border border-border">
                    <p className="text-base font-bold">{referralStats.rewarded}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Referrals
                    </p>
                  </div>
                  <div className="bg-muted rounded-md p-2 text-center border border-border">
                    <p className="text-base font-bold">
                      {formatPaisa(BigInt(String(referralStats.totalEarnings).split('.')[0]))}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Earned
                    </p>
                  </div>
                  <div className="bg-muted rounded-md p-2 text-center border border-border">
                    <p className="text-base font-bold">{referralStats.pending}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Pending
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Separator className="mb-6" />

        {/* Security & Settings */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 px-1 flex items-center gap-2">
            <IoLockClosedOutline className="text-primary" size={16} />
            Security & Settings
          </h2>
          <div className="space-y-2">
            {/* Change Password */}
            <Card>
              <Button
                variant="ghost"
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="w-full justify-start h-auto p-4 hover:bg-accent"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <IoLockClosedOutline className="text-primary" size={18} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">Change Password</p>
                    <p className="text-xs text-muted-foreground">
                      {showPasswordForm ? "Cancel" : "Update your password"}
                    </p>
                  </div>
                  <IoChevronForward className={cn(
                    "text-muted-foreground transition-transform",
                    showPasswordForm && "rotate-90"
                  )} size={18} />
                </div>
              </Button>

              {/* Password Change Form */}
              {showPasswordForm && (
                <div className="px-4 pb-4 space-y-3">
                  <AuthInput
                    type="text"
                    label="Username/Email"
                    value={userProfile.email}
                    disabled
                  />
                  <div className="relative">
                    <AuthInput
                      type={showCurrentPassword ? "text" : "password"}
                      label="Current Password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-9 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? <IoEyeOffOutline size={18} /> : <IoEyeOutline size={18} />}
                    </button>
                  </div>
                  <div className="relative">
                    <AuthInput
                      type={showNewPassword ? "text" : "password"}
                      label="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 6 characters)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-9 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <IoEyeOffOutline size={18} /> : <IoEyeOutline size={18} />}
                    </button>
                  </div>
                  <Button
                    onClick={handlePasswordChange}
                    disabled={isChangingPassword || !currentPassword || !newPassword}
                    className="w-full"
                  >
                    {isChangingPassword ? "Changing..." : "Change Password"}
                  </Button>
                </div>
              )}
            </Card>

            {/* Payment Methods */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => router.push("/payment-methods")}
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <IoCardOutline size={18} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground">Payment Methods</p>
                <p className="text-xs text-muted-foreground">Manage UPI & bank accounts</p>
              </div>
              <IoChevronForward className="text-muted-foreground flex-shrink-0" size={18} />
            </Button>

            {/* Phone Verification */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <IoShieldCheckmarkOutline className={userProfile.phoneNumberVerified ? "text-green-500" : "text-muted-foreground"} size={18} />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Phone Verification
                  </span>
                  {userProfile.phoneNumberVerified && (
                    <Badge variant="default" className="text-[10px]">Verified</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {userProfile.phoneNumberVerified
                    ? userProfile.phoneNumber
                    : "Verify your phone number for security"
                  }
                </p>
              </div>
              <IoChevronForward className="text-muted-foreground flex-shrink-0" size={18} />
            </Button>

            {/* Account Settings */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => router.push("/settings")}
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <IoSettingsOutline size={18} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground">Account Settings</p>
                <p className="text-xs text-muted-foreground">Personal info, preferences</p>
              </div>
              <IoChevronForward className="text-muted-foreground flex-shrink-0" size={18} />
            </Button>

            {/* Support */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => router.push("/support")}
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <IoHeadsetOutline size={18} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground">Help & Support</p>
                <p className="text-xs text-muted-foreground">FAQ, live chat, contact us</p>
              </div>
              <IoChevronForward className="text-muted-foreground flex-shrink-0" size={18} />
            </Button>
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
