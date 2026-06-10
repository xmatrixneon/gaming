"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/game";
import { BottomNav } from "@/components/game";
import { BOTTOM_NAV_ITEMS } from "@/lib/config";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/trpc/client";
import { MethodCard } from "@/components/game/shared/method-card";
import { AuthInput } from "@/components/game/auth/auth-input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  IoHomeOutline,
  IoArrowDownCircleOutline,
  IoArrowUpCircleOutline,
  IoPersonOutline,
  IoMenuOutline,
  IoQrCodeOutline,
} from "react-icons/io5";
import { toast } from "sonner";

// Minimum and maximum deposit amounts (in paisa)
const MIN_DEPOSIT = 100; // ₹1.00
const MAX_DEPOSIT = 10000000; // ₹100,000.00

export default function DepositPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  // Fetch available gateways
  const { data: gateways, isLoading: gatewaysLoading } = api.deposit.getAvailableGateways.useQuery();

  // Deposit initiation mutation
  const initiateDeposit = api.transaction.initiateDeposit.useMutation();

  // Form state
  const [amount, setAmount] = React.useState("");
  const [selectedGateway, setSelectedGateway] = React.useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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

  // Handle deposit initiation
  const handleDeposit = async () => {
    // Validation
    if (!amount || isNaN(Number(amount))) {
      toast.error("Please enter a valid amount");
      return;
    }

    const amountInPaisa = Math.round(parseFloat(amount) * 100);

    if (amountInPaisa < MIN_DEPOSIT) {
      toast.error(`Minimum deposit is ₹${(MIN_DEPOSIT / 100).toFixed(2)}`);
      return;
    }

    if (amountInPaisa > MAX_DEPOSIT) {
      toast.error(`Maximum deposit is ₹${(MAX_DEPOSIT / 100).toFixed(2)}`);
      return;
    }

    if (!selectedGateway) {
      toast.error("Please select a payment gateway");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await initiateDeposit.mutateAsync({
        amount: amountInPaisa.toString(),
        gatewayPriority: selectedGateway,
        currency: "INR",
      });

      if (result.success && result.paymentUrl) {
        // Redirect to payment gateway
        window.location.href = result.paymentUrl;
      } else {
        toast.error(result.message || "Failed to initiate deposit");
      }
    } catch (error) {
      console.error("[DEPOSIT] Error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to initiate deposit. Please try again.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick amount buttons
  const quickAmounts = [100, 500, 1000, 5000, 10000];

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
          Choose amount and payment gateway
        </p>

        {/* Amount Input Section */}
        <Card className="p-4 mb-6">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Deposit Amount (₹)
          </label>
          <AuthInput
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-2xl font-bold"
            min="1"
            step="0.01"
          />

          {/* Quick amount buttons */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {quickAmounts.map((quickAmount) => (
              <Button
                key={quickAmount}
                variant="outline"
                size="sm"
                onClick={() => setAmount(quickAmount.toString())}
                className="flex-1 min-w-[60px]"
              >
                ₹{quickAmount}
              </Button>
            ))}
          </div>

          {/* Amount info */}
          <div className="mt-4 text-xs text-muted-foreground">
            Min: ₹{(MIN_DEPOSIT / 100).toFixed(2)} | Max: ₹{(MAX_DEPOSIT / 100).toFixed(2)}
          </div>
        </Card>

        {/* Gateway Selection */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3">Select Payment Gateway</h2>

          {gatewaysLoading ? (
            <div className="grid gap-3">
              {[1, 2].map((i) => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted" />
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-24 mb-2" />
                      <div className="h-3 bg-muted rounded w-32" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : gateways && gateways.length > 0 ? (
            <div className="grid gap-3">
              {gateways.map((gateway, index) => (
                <MethodCard
                  key={gateway.id}
                  name={gateway.displayName}
                  icon={<IoQrCodeOutline className="text-2xl text-green-500" />}
                  fee="0"
                  estimatedTime="Instant"
                  selected={selectedGateway === index + 1}
                  onClick={() => setSelectedGateway(index + 1)}
                  badge={gateway.status === "active" ? "Available" : undefined}
                  disabled={gateway.status !== "active"}
                />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">No payment gateways available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please contact support
              </p>
            </Card>
          )}
        </div>

        {/* Info Section */}
        <Card className="bg-muted/30 border-border/50 p-4 mb-6">
          <p className="text-xs text-muted-foreground text-center">
            💡 You&apos;ll be redirected to our secure payment gateway to complete your deposit
          </p>
        </Card>

        {/* Deposit Button */}
        <Button
          onClick={handleDeposit}
          disabled={!amount || !selectedGateway || isSubmitting || gatewaysLoading}
          className="w-full py-6 text-base font-semibold"
          size="lg"
        >
          {isSubmitting ? (
            <>Processing...</>
          ) : (
            <>Deposit ₹{amount || "0"}</>
          )}
        </Button>

        {/* Security notice */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            🔒 Secured by 256-bit SSL encryption
          </p>
        </div>
      </div>

      <BottomNav items={NAV_ITEMS_WITH_ICONS} active="deposit" onChange={handleNavigate} />
    </div>
  );
}
