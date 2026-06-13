"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/game";
import { BottomNav } from "@/components/game";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/trpc/client";
import { formatPaisa } from "@/lib/format-currency";
import { BOTTOM_NAV_ITEMS } from "@/lib/config";
import { toast } from "sonner";
import {
  IoGiftOutline,
  IoCopyOutline,
  IoShareOutline,
  IoPersonAddOutline,
  IoHomeOutline,
  IoArrowDownCircleOutline,
  IoArrowUpCircleOutline,
  IoPersonOutline,
  IoMenuOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  if (status === "rewarded") {
    return (
      <Badge variant="default" className="text-[10px] px-1.5 py-0">
        Rewarded
      </Badge>
    );
  }
  if (status === "qualified") {
    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
        Qualified
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
      Pending
    </Badge>
  );
}

function maskName(username: string | null | undefined, email: string | null | undefined): string {
  const raw = username || email?.split("@")[0] || "User";
  if (raw.length <= 3) return raw + "***";
  return raw.slice(0, 3) + "***";
}

export default function ReferralPage() {
  const router = useRouter();
  const { isAuthenticated, user: authUser, isLoading: authLoading } = useAuth();
  const [copied, setCopied] = React.useState(false);

  const { data: referralData } = api.referral.getReferralCode.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: referralStats } = api.referral.getReferralStats.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: history } = api.referral.getReferralHistory.useQuery(
    { limit: 50, offset: 0 },
    { enabled: isAuthenticated },
  );

  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/signin");
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background max-w-md mx-auto flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !authUser) return null;

  const handleCopy = () => {
    if (referralData?.shareLink) {
      navigator.clipboard.writeText(referralData.shareLink);
      setCopied(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (referralData?.shareLink && navigator.share) {
      try {
        await navigator.share({
          title: "Join ClausBet",
          text: "Use my referral link to sign up and get bonuses!",
          url: referralData.shareLink,
        });
      } catch {
        // user cancelled — no-op
      }
    } else {
      handleCopy();
    }
  };

  const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    home: IoHomeOutline,
    deposit: IoArrowDownCircleOutline,
    withdraw: IoArrowUpCircleOutline,
    profile: IoPersonOutline,
    menu: IoMenuOutline,
  };

  const NAV_ITEMS_WITH_ICONS = BOTTOM_NAV_ITEMS.map((item) => ({
    id: item.id,
    icon: NAV_ICONS[item.id],
    label: item.label,
  }));

  const handleNavigate = (itemId: string) => {
    const navItem = BOTTOM_NAV_ITEMS.find((item) => item.id === itemId);
    if (navItem) router.push(navItem.route);
  };

  return (
    <div className={cn("min-h-screen bg-background text-foreground max-w-md mx-auto pb-safe-nav")}>
      <AppHeader
        showBackButton
        isAuthenticated={isAuthenticated}
        user={authUser ? {
          username: authUser.username || authUser.email?.split("@")[0] || "Player",
          avatar: authUser.image || "",
          balance: parseFloat(authUser.balance || "0"),
          vipLevel: authUser.vipLevel || "Bronze",
        } : undefined}
        notificationCount={0}
        title="Refer & Earn"
      />

      <div className="px-4 py-5 space-y-4 sm:px-5">
        {/* Code card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                <IoGiftOutline size={17} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">Refer &amp; Earn</p>
                <p className="text-xs text-muted-foreground">
                  Earn 10% of your friend&apos;s first deposit, up to ₹2,000
                </p>
              </div>
            </div>

            {referralData?.referralCode ? (
              <>
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
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCopy}>
                      <IoCopyOutline size={13} className="mr-1" />
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleShare}>
                      <IoShareOutline size={13} className="mr-1" />
                      Share
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground break-all">
                  {referralData.shareLink}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading your referral code…</p>
            )}
          </CardContent>
        </Card>

        {/* Stats row */}
        {referralStats && (
          <div className="grid grid-cols-3 gap-2">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold">{referralStats.rewarded}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                  Rewarded
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold">
                  {formatPaisa(BigInt(String(referralStats.totalEarnings).split('.')[0]))}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                  Earned
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold">{referralStats.pending}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                  Pending
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Separator />

        {/* History */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <IoPersonAddOutline size={15} />
            Referral History
          </h2>

          {!history || history.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <IoGiftOutline size={32} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">No referrals yet</p>
                <p className="text-xs text-muted-foreground">
                  Share your code with friends to start earning bonuses.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <IoPersonOutline size={15} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {maskName(item.referredUser?.username, item.referredUser?.email)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.referredUser?.createdAt
                            ? new Date(item.referredUser.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                      <StatusBadge status={item.status} />
                      {item.bonusTransaction?.amount != null && (
                        <p className="text-xs font-medium text-foreground">
                          +{formatPaisa(BigInt(String(item.bonusTransaction.amount).split('.')[0]))}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav items={NAV_ITEMS_WITH_ICONS} active="profile" onChange={handleNavigate} />
    </div>
  );
}
