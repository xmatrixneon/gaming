"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/game";
import { AuthHeader } from "@/components/game";
import { AuthInput, AuthButton } from "@/components/game/auth";
import { MethodCard, BalanceCard } from "@/components/game/shared";
import { BottomNav } from "@/components/game";
import { BOTTOM_NAV_ITEMS, formatUserCurrency } from "@/lib/config";
import { useAuth } from "@/hooks/use-auth";
import {
  IoWalletOutline,
  IoCardOutline,
  IoCashOutline,
  IoArrowUpCircleOutline,
  IoHomeOutline,
  IoArrowDownCircleOutline,
  IoPersonOutline,
  IoMenuOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

// Withdrawal method definitions
const WITHDRAWAL_METHODS = [
  {
    id: "bitcoin",
    name: "Bitcoin",
    icon: <IoWalletOutline />,
    fee: "0.0005 BTC",
    estimatedTime: "30-60 minutes",
    minAmount: "0.001 BTC",
    maxAmount: "10 BTC",
  },
  {
    id: "ethereum",
    name: "Ethereum",
    icon: <IoWalletOutline />,
    fee: "0.01 ETH",
    estimatedTime: "15-30 minutes",
    minAmount: "0.01 ETH",
    maxAmount: "100 ETH",
  },
  {
    id: "bank-transfer",
    name: "Bank Transfer",
    icon: <IoCashOutline />,
    fee: "$5.00",
    estimatedTime: "1-3 business days",
    minAmount: "$50",
    maxAmount: "$10,000",
  },
];

// User balances (raw amounts for dynamic formatting)
const USER_BALANCES = [
  { currency: "USD", balance: 12458.50, icon: "$", subtitle: "Available" },
  { currency: "BTC", balance: 0.2458, icon: "₿", subtitle: "≈ $6,145" },
  { currency: "ETH", balance: 1.8234, icon: "Ξ", subtitle: "≈ $4,550" },
];

export default function WithdrawPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [selectedMethod, setSelectedMethod] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState("");
  const [withdrawalAddress, setWithdrawalAddress] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);

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

  // Get selected method details
  const selectedMethodData = WITHDRAWAL_METHODS.find(
    (method) => method.id === selectedMethod
  );

  // Handle navigation
  const handleNavigate = (itemId: string) => {
    const navItem = BOTTOM_NAV_ITEMS.find((item) => item.id === itemId);
    if (navItem) {
      router.push(navItem.route);
    }
  };

  // Calculate fee based on amount and method
  const calculatedFee = React.useMemo(() => {
    if (!selectedMethodData || !amount) return null;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return null;

    // Simple fee calculation logic (would be more complex in production)
    if (selectedMethodData.name === "Bitcoin") {
      return "0.0005 BTC";
    }
    if (selectedMethodData.name === "Ethereum") {
      return "0.01 ETH";
    }
    if (selectedMethodData.name === "Bank Transfer") {
      return "$5.00";
    }
    return selectedMethodData.fee;
  }, [selectedMethodData, amount]);

  // Calculate net amount
  const netAmount = React.useMemo(() => {
    if (!amount || !calculatedFee) return null;
    // This would need proper calculation based on currency
    return amount;
  }, [amount, calculatedFee]);

  // Handle withdrawal submission
  const handleWithdraw = async () => {
    if (!selectedMethod || !amount || !withdrawalAddress) {
      return;
    }

    setIsProcessing(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // TODO: Integrate with actual withdrawal API
    console.log({
      method: selectedMethod,
      amount,
      withdrawalAddress,
    });

    setIsProcessing(false);

    // Show success and redirect
    alert("Withdrawal request submitted successfully!");
    router.push("/history");
  };

  // Validate amount against method limits
  const isValidAmount = React.useMemo(() => {
    if (!selectedMethodData || !amount) return false;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return false;

    // Parse min/max (simplified - would be more robust in production)
    const min = parseFloat(selectedMethodData.minAmount.replace(/[^0-9.]/g, ""));
    const max = parseFloat(selectedMethodData.maxAmount.replace(/[^0-9.]/g, ""));

    return numAmount >= min && numAmount <= max;
  }, [selectedMethodData, amount]);

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
        title="Withdraw"
      />

      <div className="px-5 py-7">
        {/* Page title */}
        <h1 className="text-2xl font-bold mb-2">Withdraw Funds</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Choose your preferred withdrawal method
        </p>

        {/* Balance Overview */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Your Balances
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {USER_BALANCES.map((balance) => (
              <BalanceCard
                key={balance.currency}
                currency={balance.currency}
                balance={formatUserCurrency(balance.balance)}
                icon={balance.icon}
                subtitle={balance.subtitle}
                onClick={() => setAmount(String(balance.balance))}
                className="hover:border-primary/50"
              />
            ))}
          </div>
        </section>

        {/* Withdrawal Methods */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Withdrawal Method
          </h2>
          <div className="space-y-2.5">
            {WITHDRAWAL_METHODS.map((method) => (
              <MethodCard
                key={method.id}
                name={method.name}
                icon={method.icon}
                fee={method.fee}
                estimatedTime={method.estimatedTime}
                selected={selectedMethod === method.id}
                onClick={() => setSelectedMethod(method.id)}
              />
            ))}
          </div>
        </section>

        {/* Amount and Address Input */}
        {selectedMethod && (
          <section className="mb-6 space-y-4 fade-in">
            <AuthInput
              label="Amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              error={
                amount && !isValidAmount
                  ? `Amount must be between ${selectedMethodData?.minAmount} and ${selectedMethodData?.maxAmount}`
                  : undefined
              }
            />

            {/* Amount limits info */}
            {selectedMethodData && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Min: {selectedMethodData.minAmount}</span>
                <span>Max: {selectedMethodData.maxAmount}</span>
              </div>
            )}

            {/* Withdrawal Address */}
            <AuthInput
              label="Withdrawal Address"
              type="text"
              placeholder={`Enter your ${selectedMethodData?.name} address`}
              value={withdrawalAddress}
              onChange={(e) => setWithdrawalAddress(e.target.value)}
              required
              error={
                withdrawalAddress && withdrawalAddress.length < 10
                  ? "Please enter a valid address"
                  : undefined
              }
            />

            {/* Fee Display */}
            {calculatedFee && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">{amount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee:</span>
                  <span className="font-medium text-destructive">-{calculatedFee}</span>
                </div>
                <div className="border-t border-border my-1" />
                <div className="flex justify-between text-sm font-semibold">
                  <span>You will receive:</span>
                  <span className="text-primary">{netAmount}</span>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Submit Button */}
        {selectedMethod && amount && withdrawalAddress && (
          <div className="fade-in">
            <AuthButton
              variant="primary"
              onClick={handleWithdraw}
              disabled={isProcessing || !isValidAmount || !withdrawalAddress}
              className="w-full"
            >
              {isProcessing ? "Processing..." : "Withdraw Now"}
            </AuthButton>

            {/* Warning */}
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                <strong>Important:</strong> Withdrawals cannot be reversed. Please
                verify the address is correct before submitting.
              </p>
            </div>
          </div>
        )}

        {/* Recent Withdrawals */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Recent Withdrawals
          </h2>
          <div className="text-center py-8 bg-muted/50 rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              No recent withdrawals
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Your withdrawal history will appear here
            </p>
          </div>
        </section>
      </div>

      <BottomNav items={NAV_ITEMS_WITH_ICONS} active="withdraw" onChange={handleNavigate} />
    </div>
  );
}
