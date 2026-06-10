"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/game";
import { BalanceCard } from "@/components/game/shared";
import { BottomNav } from "@/components/game";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthInput } from "@/components/game/auth/auth-input";
import { BOTTOM_NAV_ITEMS, formatUserCurrency } from "@/lib/config";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  IoWalletOutline,
  IoCardOutline,
  IoArrowUpCircleOutline,
  IoHomeOutline,
  IoArrowDownCircleOutline,
  IoPersonOutline,
  IoMenuOutline,
  IoStar,
  IoCheckmarkCircle,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

export default function WithdrawPage() {
  const router = useRouter();
  const { isAuthenticated, user: authUser } = useAuth();

  // Form state
  const [amount, setAmount] = React.useState("");
  const [withdrawalPassword, setWithdrawalPassword] = React.useState("");
  const [selectedMethodId, setSelectedMethodId] = React.useState<number | null>(null);
  const [useSavedMethod, setUseSavedMethod] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Manual entry state (when not using saved method)
  const [manualMethodType, setManualMethodType] = React.useState<"upi" | "bank_transfer">("upi");
  const [manualUpiId, setManualUpiId] = React.useState("");
  const [manualAccountNumber, setManualAccountNumber] = React.useState("");
  const [manualAccountHolder, setManualAccountHolder] = React.useState("");
  const [manualBankName, setManualBankName] = React.useState("");
  const [manualIfscCode, setManualIfscCode] = React.useState("");

  // Queries
  const { data: paymentMethods } = api.paymentMethod.list.useQuery();
  const { data: passwordStatus } = api.paymentMethod.hasPassword.useQuery();
  const withdrawMutation = api.transaction.requestWithdrawal.useMutation();

  // Redirect to signin if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated || !authUser) {
      router.push("/signin");
    }
  }, [isAuthenticated, authUser, router]);

  // Handle loading state
  if (!isAuthenticated || !authUser) {
    return (
      <div className="min-h-screen bg-background text-foreground max-w-md mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Get selected saved method
  const selectedMethod = paymentMethods?.find((m) => m.id === selectedMethodId);

  // Handle saved method selection
  const handleSelectSavedMethod = (method: any) => {
    setSelectedMethodId(method.id);
    setUseSavedMethod(true);
    // Clear manual entry
    setManualUpiId("");
    setManualAccountNumber("");
    setManualAccountHolder("");
    setManualBankName("");
    setManualIfscCode("");
  };

  // Handle manual entry mode
  const handleUseManualEntry = () => {
    setSelectedMethodId(null);
    setUseSavedMethod(false);
  };

  // Handle withdrawal submission
  const handleWithdraw = async () => {
    // Validation
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return toast.error("Please enter a valid amount");
    }

    // Check password requirement
    if (passwordStatus?.hasPassword && !withdrawalPassword) {
      return toast.error("Password is required for withdrawal");
    }

    // Get payout details
    let payoutDetails = {
      upiId: manualUpiId || undefined,
      accountNumber: manualAccountNumber || undefined,
      accountHolder: manualAccountHolder || undefined,
      bankName: manualBankName || undefined,
      ifscCode: manualIfscCode || undefined,
    };

    // If using saved method
    if (useSavedMethod && selectedMethod) {
      payoutDetails = {
        upiId: selectedMethod.upiId || undefined,
        accountNumber: selectedMethod.accountNumber || undefined,
        accountHolder: selectedMethod.accountHolder || undefined,
        bankName: selectedMethod.bankName || undefined,
        ifscCode: selectedMethod.ifscCode || undefined,
      };
    }

    // Validate based on method type
    const methodType = useSavedMethod && selectedMethod ? selectedMethod.type : manualMethodType;
    if (methodType === "upi" && !payoutDetails.upiId) {
      return toast.error("UPI ID is required");
    }
    if (methodType === "bank_transfer" && (!payoutDetails.accountNumber || !payoutDetails.ifscCode)) {
      return toast.error("Account number and IFSC code are required");
    }

    setIsProcessing(true);

    try {
      // Convert amount to paisa (multiply by 100)
      const amountInPaisa = Math.round(parseFloat(amount) * 100).toString();

      await withdrawMutation.mutateAsync({
        amount: amountInPaisa,
        method: methodType === "upi" ? "upi" : "okpay-bank",
        details: payoutDetails,
        password: withdrawalPassword || undefined,
        useSavedMethod,
        savedMethodId: selectedMethodId || undefined,
      });

      toast.success("Withdrawal request submitted successfully!");
      router.push("/history");
    } catch (err: any) {
      toast.error(err.message || "Failed to process withdrawal");
    } finally {
      setIsProcessing(false);
    }
  };

  // Navigation handler
  const handleNavigate = (itemId: string) => {
    const navItem = BOTTOM_NAV_ITEMS.find((item) => item.id === itemId);
    if (navItem) {
      router.push(navItem.route);
    }
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

  return (
    <div className="min-h-screen bg-background text-foreground max-w-md mx-auto pb-24">
      {/* Header */}
      <AppHeader
        title="Withdraw"
        showBackButton
        isAuthenticated={isAuthenticated}
        user={authUser ? {
          username: authUser.username,
          avatar: authUser.image,
          balance: parseFloat(authUser.balance || "0"),
          vipLevel: authUser.vipLevel,
        } : undefined}
      />

      <div className="p-4 space-y-4">
        {/* Balance Card */}
        <BalanceCard
          currency="INR"
          balance={formatUserCurrency(authUser.balance || "0")}
          icon="₹"
        />

        {/* Amount Input */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <AuthInput
              label="Amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <div className="text-xs text-muted-foreground">
              Min: ₹100 | Max: ₹100,000
            </div>
          </CardContent>
        </Card>

        {/* Saved Payment Methods */}
        {paymentMethods && paymentMethods.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Saved Payment Methods</h3>

              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  onClick={() => handleSelectSavedMethod(method)}
                  className={cn(
                    "p-3 border rounded-lg cursor-pointer transition-colors",
                    selectedMethodId === method.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Selection indicator */}
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center">
                      {selectedMethodId === method.id && (
                        <IoCheckmarkCircle className="text-primary" size={18} />
                      )}
                    </div>

                    {/* Icon */}
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {method.type === "upi" ? (
                        <IoWalletOutline size={20} className="text-primary" />
                      ) : (
                        <IoCardOutline size={20} className="text-primary" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {method.label || (method.type === "upi" ? "UPI" : "Bank")}
                        </p>
                        {method.isPrimary && (
                          <IoStar size={14} className="text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {method.type === "upi"
                          ? method.upiId
                          : `${method.bankName} • ${method.accountNumber}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Manual Entry Option */}
              <button
                onClick={handleUseManualEntry}
                className={cn(
                  "w-full p-3 border rounded-lg text-sm transition-colors",
                  !useSavedMethod && selectedMethodId === null
                    ? "border-primary bg-primary/5"
                    : "border-dashed border-border hover:border-primary/50"
                )}
              >
                + Enter new payment details
              </button>
            </CardContent>
          </Card>
        )}

        {/* Manual Entry Form (when not using saved method) */}
        {(!useSavedMethod || selectedMethodId === null) && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="font-semibold text-sm">Payment Details</h3>

              {/* Method Type Toggle */}
              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setManualMethodType("upi")}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                    manualMethodType === "upi"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  UPI
                </button>
                <button
                  onClick={() => setManualMethodType("bank_transfer")}
                  className={cn(
                    "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                    manualMethodType === "bank_transfer"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Bank Transfer
                </button>
              </div>

              {/* UPI Form */}
              {manualMethodType === "upi" && (
                <AuthInput
                  label="UPI ID"
                  placeholder="username@upi"
                  value={manualUpiId}
                  onChange={(e) => setManualUpiId(e.target.value)}
                  required
                />
              )}

              {/* Bank Form */}
              {manualMethodType === "bank_transfer" && (
                <>
                  <AuthInput
                    label="Account Number"
                    placeholder="Enter account number"
                    value={manualAccountNumber}
                    onChange={(e) => setManualAccountNumber(e.target.value)}
                    required
                  />
                  <AuthInput
                    label="Account Holder Name"
                    placeholder="Enter account holder name"
                    value={manualAccountHolder}
                    onChange={(e) => setManualAccountHolder(e.target.value)}
                    required
                  />
                  <AuthInput
                    label="Bank Name"
                    placeholder="e.g., HDFC Bank"
                    value={manualBankName}
                    onChange={(e) => setManualBankName(e.target.value)}
                    required
                  />
                  <AuthInput
                    label="IFSC Code"
                    placeholder="ABCD0123456"
                    value={manualIfscCode}
                    onChange={(e) => setManualIfscCode(e.target.value.toUpperCase())}
                    required
                  />
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Password Field (if user has password) */}
        {passwordStatus?.hasPassword && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <AuthInput
                label="Password"
                type="password"
                placeholder="Enter your password to confirm withdrawal"
                value={withdrawalPassword}
                onChange={(e) => setWithdrawalPassword(e.target.value)}
                required
              />
            </CardContent>
          </Card>
        )}

        {/* No Password Warning */}
        {!passwordStatus?.hasPassword && (
          <Card className="bg-yellow-500/10 border-yellow-500/20">
            <CardContent className="p-4">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                <strong>Security Notice:</strong> For enhanced security, consider setting
                a password in your{" "}
                <button onClick={() => router.push("/profile")} className="underline">
                  profile settings
                </button>
                .
              </p>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleWithdraw}
          disabled={isProcessing || !amount}
          size="lg"
          className="w-full"
        >
          {isProcessing ? "Processing..." : "Withdraw Now"}
        </Button>

        {/* Warning */}
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            <strong>Important:</strong> Withdrawals cannot be reversed. Please verify all
            details are correct before submitting.
          </p>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav items={NAV_ITEMS_WITH_ICONS} active="withdraw" onChange={handleNavigate} />
    </div>
  );
}
