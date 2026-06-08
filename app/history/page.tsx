"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/game";
import { AuthHeader } from "@/components/game";
import { TransactionItem } from "@/components/game/shared";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/game";
import { BOTTOM_NAV_ITEMS } from "@/lib/config";
import { useAuth } from "@/hooks/use-auth";
import {
  IoArrowDownCircleOutline,
  IoArrowUpCircleOutline,
  IoFilterOutline,
  IoCalendarOutline,
  IoHomeOutline,
  IoWalletOutline,
  IoPersonOutline,
  IoMenuOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

type TabValue = "all" | "deposits" | "withdrawals";
type FilterStatus = "all" | "pending" | "completed" | "failed";

// Mock transaction data
const TRANSACTIONS = [
  {
    id: "tx1",
    type: "deposit" as const,
    amount: "0.5",
    currency: "BTC",
    status: "completed" as const,
    date: "2024-01-15 14:30",
    icon: "₿",
  },
  {
    id: "tx2",
    type: "withdrawal" as const,
    amount: "1.2",
    currency: "ETH",
    status: "pending" as const,
    date: "2024-01-14 09:15",
    icon: "Ξ",
  },
  {
    id: "tx3",
    type: "deposit" as const,
    amount: "500",
    currency: "USD",
    status: "completed" as const,
    date: "2024-01-13 16:45",
    icon: "$",
  },
  {
    id: "tx4",
    type: "withdrawal" as const,
    amount: "200",
    currency: "USD",
    status: "failed" as const,
    date: "2024-01-12 11:20",
    icon: "$",
  },
  {
    id: "tx5",
    type: "deposit" as const,
    amount: "1500",
    currency: "USDT",
    status: "processing" as const,
    date: "2024-01-11 08:00",
    icon: "₮",
  },
  {
    id: "tx6",
    type: "withdrawal" as const,
    amount: "0.02",
    currency: "BTC",
    status: "completed" as const,
    date: "2024-01-10 15:30",
    icon: "₿",
  },
];

// Bottom navigation items (history not in bottom nav, using menu)
const NAV_ITEMS = [
  { id: "home", icon: IoHomeOutline, label: "Home" },
  { id: "deposit", icon: IoArrowDownCircleOutline, label: "Deposit" },
  { id: "withdraw", icon: IoArrowUpCircleOutline, label: "Withdraw" },
  { id: "profile", icon: IoPersonOutline, label: "Profile" },
  { id: "menu", icon: IoMenuOutline, label: "More" },
];

export default function HistoryPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [tab, setTab] = React.useState<TabValue>("all");
  const [statusFilter, setStatusFilter] = React.useState<FilterStatus>("all");
  const [showFilterModal, setShowFilterModal] = React.useState(false);

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

  // Filter transactions based on tab and status
  const filteredTransactions = React.useMemo(() => {
    return TRANSACTIONS.filter((tx) => {
      // Type filter
      if (tab === "deposits" && tx.type !== "deposit") return false;
      if (tab === "withdrawals" && tx.type !== "withdrawal") return false;

      // Status filter
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;

      return true;
    });
  }, [tab, statusFilter]);

  // Calculate stats
  const stats = React.useMemo(() => {
    const deposits = TRANSACTIONS.filter((tx) => tx.type === "deposit");
    const withdrawals = TRANSACTIONS.filter((tx) => tx.type === "withdrawal");

    return {
      totalDeposits: deposits.length,
      totalWithdrawals: withdrawals.length,
      pendingCount: TRANSACTIONS.filter((tx) => tx.status === "pending").length,
    };
  }, []);

  // Get active filter label
  const getFilterLabel = () => {
    if (statusFilter === "all") return "All Status";
    return statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);
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
        user={user ? {
          username: user.username,
          avatar: user.image,
          balance: user.balance ? parseFloat(user.balance) : 0,
          vipLevel: user.vipLevel,
        } : undefined}
        notificationCount={1}
        title="History"
      />

      <div className="px-5 py-7">
        {/* Page title */}
        <h1 className="text-2xl font-bold mb-2">Transaction History</h1>
        <p className="text-sm text-muted-foreground mb-6">
          View your deposit and withdrawal history
        </p>

        {/* Stats Overview */}
        <section className="mb-6 grid grid-cols-3 gap-2">
          <div className="bg-muted rounded-lg p-3 text-center border border-border">
            <div className="text-lg font-bold text-foreground">{stats.totalDeposits}</div>
            <div className="text-xs text-muted-foreground">Deposits</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center border border-border">
            <div className="text-lg font-bold text-foreground">{stats.totalWithdrawals}</div>
            <div className="text-xs text-muted-foreground">Withdrawals</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center border border-border">
            <div className="text-lg font-bold text-yellow-500">{stats.pendingCount}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
        </section>

        {/* Tabs */}
        <section className="mb-4">
          <div className="flex gap-2 p-1 bg-muted rounded-lg">
            {[
              { value: "all" as TabValue, label: "All" },
              { value: "deposits" as TabValue, label: "Deposits" },
              { value: "withdrawals" as TabValue, label: "Withdrawals" },
            ].map((tabItem) => (
              <Button
                key={tabItem.value}
                variant={tab === tabItem.value ? "default" : "ghost"}
                onClick={() => setTab(tabItem.value)}
                className="flex-1"
              >
                {tabItem.label}
              </Button>
            ))}
          </div>
        </section>

        {/* Filter Button */}
        <section className="mb-4">
          <Button
            variant="outline"
            onClick={() => setShowFilterModal(!showFilterModal)}
            className="w-full justify-start"
          >
            <IoFilterOutline size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium">{getFilterLabel()}</span>
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full ml-auto",
                statusFilter !== "all" ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          </Button>

          {/* Filter Dropdown */}
          {showFilterModal && (
            <div className="mt-2 p-2 bg-muted rounded-lg border border-border space-y-1">
              {[
                { value: "all" as FilterStatus, label: "All Status" },
                { value: "pending" as FilterStatus, label: "Pending" },
                { value: "completed" as FilterStatus, label: "Completed" },
                { value: "failed" as FilterStatus, label: "Failed" },
              ].map((filter) => (
                <Button
                  key={filter.value}
                  variant={statusFilter === filter.value ? "default" : "ghost"}
                  onClick={() => {
                    setStatusFilter(filter.value);
                    setShowFilterModal(false);
                  }}
                  className="w-full justify-start"
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          )}
        </section>

        {/* Transaction List */}
        <section>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 bg-muted/50 rounded-lg border border-dashed border-border">
              <IoCalendarOutline
                size={32}
                className="mx-auto text-muted-foreground/50 mb-2"
              />
              <p className="text-sm text-muted-foreground">
                No transactions found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  type={tx.type}
                  amount={tx.amount}
                  currency={tx.currency}
                  status={tx.status}
                  date={tx.date}
                  txId={tx.id}
                  icon={tx.icon}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <BottomNav items={NAV_ITEMS_WITH_ICONS} active="menu" onChange={handleNavigate} />
    </div>
  );
}
