"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/game";
import { AuthButton } from "@/components/game/auth";
import { BalanceCard } from "@/components/game/shared";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/game";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AuthInput } from "@/components/game/auth/auth-input";
import { BOTTOM_NAV_ITEMS, formatUserCurrency } from "@/lib/config";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  IoArrowBackOutline,
  IoAddOutline,
  IoTrashOutline,
  IoStarOutline,
  IoStar,
  IoCardOutline,
  IoWalletOutline,
  IoArrowUpCircleOutline,
  IoHomeOutline,
  IoArrowDownCircleOutline,
  IoPersonOutline,
  IoMenuOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

export default function PaymentMethodsPage() {
  const router = useRouter();
  const { isAuthenticated, user: authUser, isLoading: authLoading } = useAuth();

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSetPrimaryDialog, setShowSetPrimaryDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<any>(null);

  // Form states
  const [methodType, setMethodType] = useState<"upi" | "bank_transfer">("upi");
  const [label, setLabel] = useState("");
  const [upiId, setUpiId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [primaryPassword, setPrimaryPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  // Queries and mutations
  const { data: methods, isLoading: methodsLoading, refetch } = api.paymentMethod.list.useQuery();
  const { data: passwordStatus } = api.paymentMethod.hasPassword.useQuery();
  const addMethod = api.paymentMethod.add.useMutation();
  const setPrimary = api.paymentMethod.setPrimary.useMutation();
  const deleteMethod = api.paymentMethod.delete.useMutation();

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
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated || !authUser) {
    return null;
  }

  // Handlers
  const handleAdd = async () => {
    try {
      if (methodType === "upi" && !upiId) {
        return toast.error("Please enter UPI ID");
      }
      if (methodType === "bank_transfer") {
        if (!accountNumber || !accountHolder || !bankName || !ifscCode) {
          return toast.error("Please fill all bank details");
        }
      }

      await addMethod.mutateAsync(
        methodType === "upi"
          ? { type: "upi", upiId, label: label || undefined }
          : {
              type: "bank_transfer",
              accountNumber,
              accountHolder,
              bankName,
              ifscCode,
              label: label || undefined,
            }
      );

      toast.success("Payment method added successfully");
      setShowAddDialog(false);
      // Reset form
      setLabel("");
      setUpiId("");
      setAccountNumber("");
      setAccountHolder("");
      setBankName("");
      setIfscCode("");
      setMethodType("upi");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to add payment method");
    }
  };

  const handleSetPrimary = async () => {
    try {
      if (passwordStatus?.hasPassword && !primaryPassword) {
        return toast.error("Password required");
      }

      await setPrimary.mutateAsync({
        methodId: selectedMethod.id,
        password: primaryPassword || undefined,
      });

      toast.success("Primary payment method updated");
      setShowSetPrimaryDialog(false);
      setPrimaryPassword("");
      setSelectedMethod(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to set primary");
    }
  };

  const handleDelete = async () => {
    try {
      if (!deletePassword) {
        return toast.error("Password required");
      }

      await deleteMethod.mutateAsync({
        methodId: selectedMethod.id,
        password: deletePassword,
      });

      toast.success("Payment method deleted");
      setShowDeleteDialog(false);
      setDeletePassword("");
      setSelectedMethod(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete payment method");
    }
  };

  const openSetPrimaryDialog = (method: any) => {
    setSelectedMethod(method);
    setShowSetPrimaryDialog(true);
  };

  const openDeleteDialog = (method: any) => {
    setSelectedMethod(method);
    setShowDeleteDialog(true);
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
    <div className="min-h-screen bg-background text-foreground max-w-md mx-auto">
      {/* Header */}
      <AppHeader
        showBackButton
        title="Payment Methods"
        isAuthenticated={isAuthenticated}
        user={authUser ? {
          username: authUser.username,
          avatar: authUser.image,
          balance: parseFloat(authUser.balance || "0"),
          vipLevel: authUser.vipLevel,
        } : undefined}
      />

      <div className="p-4 pb-24 space-y-4">
        {/* User Balance */}
        <BalanceCard
          currency="INR"
          balance={formatUserCurrency(authUser.balance || "0")}
          icon="₹"
        />

        {/* Add Payment Method Button */}
        <Button
          onClick={() => setShowAddDialog(true)}
          className="w-full gap-2"
          size="lg"
        >
          <IoAddOutline size={20} />
          Add Payment Method
        </Button>

        {/* Payment Methods List */}
        {methodsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading payment methods...</p>
          </div>
        ) : methods && methods.length > 0 ? (
          <div className="space-y-3">
            {methods.map((method) => (
              <Card key={method.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {method.type === "upi" ? (
                          <IoWalletOutline size={20} className="text-primary" />
                        ) : (
                          <IoCardOutline size={20} className="text-primary" />
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">
                            {method.label || (method.type === "upi" ? "UPI" : "Bank Transfer")}
                          </p>
                          {method.isPrimary && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                              <IoStar size={12} />
                              Primary
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {method.type === "upi" ? (
                            method.upiId
                          ) : (
                            <>
                              {method.bankName} • {method.accountNumber}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      {!method.isPrimary && (
                        <button
                          onClick={() => openSetPrimaryDialog(method)}
                          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                        >
                          <IoStarOutline size={14} />
                          Set Primary
                        </button>
                      )}
                      <button
                        onClick={() => openDeleteDialog(method)}
                        className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1"
                      >
                        <IoTrashOutline size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <IoCardOutline size={32} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-4">No payment methods yet</p>
              <Button onClick={() => setShowAddDialog(true)} variant="outline" size="sm">
                Add Your First Payment Method
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> You can save up to 5 payment methods. Bank account
              numbers are masked for security. Always double-check details before
              withdrawing.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Type Toggle */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setMethodType("upi")}
                className={cn(
                  "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                  methodType === "upi"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                UPI
              </button>
              <button
                onClick={() => setMethodType("bank_transfer")}
                className={cn(
                  "flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors",
                  methodType === "bank_transfer"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Bank Transfer
              </button>
            </div>

            {/* Label (Optional) */}
            <AuthInput
              label="Nickname (optional)"
              placeholder="e.g., My HDFC Account"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />

            {/* UPI Form */}
            {methodType === "upi" && (
              <AuthInput
                label="UPI ID"
                placeholder="username@upi"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                required
              />
            )}

            {/* Bank Form */}
            {methodType === "bank_transfer" && (
              <>
                <AuthInput
                  label="Account Number"
                  placeholder="Enter account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                />
                <AuthInput
                  label="Account Holder Name"
                  placeholder="Enter account holder name"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  required
                />
                <AuthInput
                  label="Bank Name"
                  placeholder="e.g., HDFC Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                />
                <AuthInput
                  label="IFSC Code"
                  placeholder="ABCD0123456"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  required
                />
              </>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={addMethod.isPending} className="flex-1">
                {addMethod.isPending ? "Adding..." : "Add Method"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Primary Dialog */}
      <Dialog open={showSetPrimaryDialog} onOpenChange={setShowSetPrimaryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set as Primary Payment Method?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will be your default payment method for withdrawals.
            </p>

            {passwordStatus?.hasPassword && (
              <AuthInput
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={primaryPassword}
                onChange={(e) => setPrimaryPassword(e.target.value)}
              />
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSetPrimaryDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSetPrimary}
                disabled={setPrimary.isPending}
                className="flex-1"
              >
                {setPrimary.isPending ? "Setting..." : "Set Primary"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Payment Method?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. Please confirm by entering your password.
            </p>

            <AuthInput
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMethod.isPending}
                className="flex-1"
              >
                {deleteMethod.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      <BottomNav items={NAV_ITEMS_WITH_ICONS} active="more" onChange={(id) => {
        const navItem = BOTTOM_NAV_ITEMS.find((item) => item.id === id);
        if (navItem) router.push(navItem.route);
      }} />
    </div>
  );
}
