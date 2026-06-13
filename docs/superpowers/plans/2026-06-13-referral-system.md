# Referral System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the fully-built referral backend into working user flows: auto-assign referral codes on signup, capture `?ref=` param during signup, and build the profile card + dedicated `/referral` page.

**Architecture:** Better Auth `hooks.after` middleware assigns a referral code to every new user atomically. A new `applyReferralCode` tRPC mutation handles the `?ref=` param after phone verification. Two UI surfaces display referral data: a compact card on the profile page and a full `/referral` page with history.

**Tech Stack:** Next.js 16 App Router, tRPC, Better Auth hooks, Drizzle ORM, shadcn/ui, `react-icons/io5`, `lib/format-currency.ts`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `lib/auth.ts` | Add `hooks.after` to auto-assign referral code on every new user |
| Modify | `server/routers/referral.ts` | Add `applyReferralCode` mutation; update `getReferralHistory` to include bonus amount |
| Modify | `app/signup/page.tsx` | Read `?ref=` param; call `applyReferralCode` after successful account creation |
| Modify | `app/profile/page.tsx` | Insert referral card between user profile card and Security section |
| Create | `app/referral/page.tsx` | Full referral dashboard: code card, stats, history list |
| Modify | `app/more/page.tsx` | Add "Refer & Earn" to Account section menu |

---

## Task 1: Auto-assign referral code on signup (auth.ts hook)

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Add imports to auth.ts**

At the top of `lib/auth.ts`, after the existing imports, add:

```ts
import { createAuthMiddleware } from "better-auth/api";
import { referralService } from "@/lib/referral-service";
import { user } from "@/drizzle/schema";
import { eq, isNull, and } from "drizzle-orm";
```

- [ ] **Step 2: Add hooks.after block inside the betterAuth config**

Add this new top-level key inside the `betterAuth({...})` config object, after the `experimental` block (before the closing `}`):

```ts
  // ──────────────────────────────────────────────────────────────────────────
  // HOOKS — post-signup referral code assignment
  // ──────────────────────────────────────────────────────────────────────────
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (!newSession) return;

      const userId = newSession.user.id;
      try {
        const code = await referralService.generateCode();
        // WHERE referralCode IS NULL — idempotent, safe to call on every new session
        await db
          .update(user)
          .set({ referralCode: code })
          .where(and(eq(user.id, userId), isNull(user.referralCode)));
      } catch (err) {
        // Never block auth for referral code generation failures
        console.error("[AUTH] Failed to assign referral code:", err);
      }
    }),
  },
```

- [ ] **Step 3: Verify the server starts without errors**

```bash
npm run dev
```

Expected: server starts, no TypeScript errors in terminal. Check for `[AUTH]` errors in logs on your next login — there should be none.

- [ ] **Step 4: Verify referral code is assigned on signup**

Sign up with a new phone number (or use `npx drizzle-kit studio` to check the `user` table). The `referral_code` column should be non-null after signup.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: auto-assign referral code to new users via Better Auth hook"
```

---

## Task 2: Add `applyReferralCode` mutation + update `getReferralHistory`

**Files:**
- Modify: `server/routers/referral.ts`

- [ ] **Step 1: Add `headers` import**

At the top of `server/routers/referral.ts`, add:

```ts
import { headers } from "next/headers";
import { user } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
```

The file already has `import { eq, desc } from "drizzle-orm"` and `import { user, referral } from "@/drizzle/schema"` — just add `headers` from `next/headers`.

The full updated imports block:

```ts
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/drizzle';
import { user, referral } from '@/drizzle/schema';
import { referralService } from '@/lib/referral-service';
import { headers } from 'next/headers';
```

- [ ] **Step 2: Add `applyReferralCode` mutation to the router**

Inside `export const referralRouter = router({...})`, add after `getReferralHistory`:

```ts
  /**
   * Apply a referral code after signup.
   * Never throws — referral errors must not surface to the user.
   */
  applyReferralCode: protectedProcedure
    .input(z.object({ referralCode: z.string().min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const headersList = await headers();
        const ip =
          headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          headersList.get('x-real-ip') ||
          '127.0.0.1';

        const userData = await db.query.user.findFirst({
          where: eq(user.id, ctx.user.id),
          columns: { email: true },
        });

        await referralService.createReferralOnSignup(
          ctx.user.id,
          input.referralCode,
          ip,
          userData?.email || '',
        );

        return { success: true as const };
      } catch (error) {
        return {
          success: false as const,
          error: error instanceof Error ? error.message : 'Failed to apply referral code',
        };
      }
    }),
```

- [ ] **Step 3: Update `getReferralHistory` to include bonus transaction amount**

Replace the existing `getReferralHistory` query body with one that also fetches the bonus transaction amount via the `bonusTransaction` Drizzle relation:

```ts
  getReferralHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const referrals = await db.query.referral.findMany({
        where: eq(referral.referrerId, ctx.user.id),
        with: {
          referredUser: {
            columns: {
              id: true,
              username: true,
              email: true,
              createdAt: true,
            },
          },
          bonusTransaction: {
            columns: { amount: true },
          },
        },
        orderBy: [desc(referral.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return referrals;
    }),
```

- [ ] **Step 4: Run lint to check for TypeScript errors**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add server/routers/referral.ts
git commit -m "feat: add applyReferralCode mutation and include bonus amount in referral history"
```

---

## Task 3: Capture `?ref=` param in signup page

**Files:**
- Modify: `app/signup/page.tsx`

- [ ] **Step 1: Add `useSearchParams` and mutation imports**

In `app/signup/page.tsx`, add to the existing imports:

```ts
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/trpc/client";
```

`useRouter` is already imported. `React` is already imported via `import * as React from "react"` — we need the `useRef` from it.

- [ ] **Step 2: Add `useSearchParams`, ref, and mutation inside the component**

Inside `SignUpPage`, add after the `const router = useRouter()` line:

```ts
  const searchParams = useSearchParams();
  const referralCodeRef = React.useRef<string | null>(searchParams.get('ref'));
  const applyReferralCode = api.referral.applyReferralCode.useMutation();
```

- [ ] **Step 3: Call mutation in handleSubmit after successful account creation**

In the `handleSubmit` callback, replace the final `router.push("/")` with:

```ts
      const result = await setUserPassword(state.passwordValue);
      if (!result.success) {
        updateState("error", result.error || "Failed to set password");
        return;
      }

      // Apply referral code silently — never block signup
      if (referralCodeRef.current) {
        try {
          await applyReferralCode.mutateAsync({ referralCode: referralCodeRef.current });
        } catch {
          // swallow — referral errors must never block account creation
        }
      }

      router.push("/");
```

- [ ] **Step 4: Wrap the page export in Suspense (required for useSearchParams)**

`useSearchParams()` requires the component to be wrapped in `<Suspense>`. In Next.js App Router, add a Suspense wrapper around the default export.

First, add `Suspense` to the React import at the top of `app/signup/page.tsx`:

```ts
import { Suspense } from "react";
```

Then rename the existing `export default function SignUpPage()` to `function SignUpPageInner()`, and add a new default export at the bottom of the file:

```tsx
export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpPageInner />
    </Suspense>
  );
}
```

- [ ] **Step 5: Test the flow manually**

1. Navigate to `http://localhost:3000/signup?ref=TESTCODE123`
2. Sign up with a new phone number
3. In Drizzle Studio or psql, check the `referral` table — a row with `referral_code = 'TESTCODE123'` and `referred_user_id` = new user's ID should exist (if TESTCODE123 is a real user's code, otherwise you'll see an error in logs which is correct behavior)

- [ ] **Step 6: Commit**

```bash
git add app/signup/page.tsx
git commit -m "feat: capture ?ref= param during signup and apply referral code after account creation"
```

---

## Task 4: Add referral card to profile page

**Files:**
- Modify: `app/profile/page.tsx`

- [ ] **Step 1: Add `formatPaisa` import**

In `app/profile/page.tsx`, add to the existing imports:

```ts
import { formatPaisa } from "@/lib/format-currency";
```

- [ ] **Step 2: Insert the referral card JSX**

In the JSX, the user profile card ends at line ~284 (closing `</Card>`). There are several blank lines, then `<Separator className="mb-6" />`. Replace those blank lines with the referral card:

Find this block:
```tsx
          </CardContent>
        </Card>




        

        <Separator className="mb-6" />
```

Replace with:
```tsx
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
                      {formatPaisa(BigInt(referralStats.totalEarnings))}
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
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000/profile` while logged in. The referral card should appear between the user avatar card and the Security section. If the user's `referralCode` is still null (before Task 1 runs for existing users), the card won't show — that's correct. Run `npx tsx scripts/generate-referral-codes.ts` to backfill existing users.

- [ ] **Step 4: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat: add referral card to profile page"
```

---

## Task 5: Create `/referral` page

**Files:**
- Create: `app/referral/page.tsx`

- [ ] **Step 1: Create the file**

```bash
mkdir -p /home/neo/clausbet/app/referral
```

Create `app/referral/page.tsx` with this content:

```tsx
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
  IoChevronBack,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

// ── Status badge helper ──────────────────────────────────────────────────────

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

// ── Masked display name ──────────────────────────────────────────────────────

function maskName(username: string | null | undefined, email: string | null | undefined): string {
  const raw = username || email?.split("@")[0] || "User";
  if (raw.length <= 3) return raw + "***";
  return raw.slice(0, 3) + "***";
}

// ── Page ────────────────────────────────────────────────────────────────────

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

  // Redirect if not authenticated
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

  // ── Handlers ──────────────────────────────────────────────────────────────

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
        // user cancelled share — no-op
      }
    } else {
      handleCopy();
    }
  };

  // ── Nav ───────────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={cn("min-h-screen bg-background text-foreground max-w-md mx-auto pb-safe-nav")}>
      <AppHeader
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
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-muted-foreground hover:text-foreground -ml-1"
          onClick={() => router.back()}
        >
          <IoChevronBack size={16} className="mr-1" />
          Back
        </Button>

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
                  {formatPaisa(BigInt(referralStats.totalEarnings))}
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
                          +{formatPaisa(item.bonusTransaction.amount)}
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
```

- [ ] **Step 2: Verify the page renders**

Open `http://localhost:3000/referral` while logged in. You should see:
- AppHeader with "Refer & Earn" title
- Back button
- Code card (with referral code if Task 1 ran for this user)
- Three stat tiles
- History section (empty state or list)
- Bottom nav

- [ ] **Step 3: Commit**

```bash
git add app/referral/page.tsx
git commit -m "feat: create /referral page with code card, stats, and history list"
```

---

## Task 6: Add "Refer & Earn" to more page

**Files:**
- Modify: `app/more/page.tsx`

- [ ] **Step 1: Add the referral item to the Account section**

In `app/more/page.tsx`, find the `MENU_SECTIONS` constant. The Account section currently has Profile, Wallet, and Transaction History. Add a fourth item after Transaction History:

Find this block:
```tsx
      {
        id: "history",
        label: "Transaction History",
        icon: <IoTimeOutline size={20} />,
        description: "View your transactions",
        route: "/history",
      },
    ],
  },
```

Replace with:
```tsx
      {
        id: "history",
        label: "Transaction History",
        icon: <IoTimeOutline size={20} />,
        description: "View your transactions",
        route: "/history",
      },
      {
        id: "referral",
        label: "Refer & Earn",
        icon: <IoGiftOutline size={20} />,
        description: "Invite friends and earn bonuses",
        route: "/referral",
      },
    ],
  },
```

`IoGiftOutline` is already imported in `app/more/page.tsx`.

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000/more`. The Account section should now show "Refer & Earn" after Transaction History. Tapping it should navigate to `/referral`.

- [ ] **Step 3: Commit**

```bash
git add app/more/page.tsx
git commit -m "feat: add Refer & Earn link to more page menu"
```

---

## Task 7: Backfill existing users + end-to-end verification

- [ ] **Step 1: Backfill referral codes for existing users**

```bash
npx tsx scripts/generate-referral-codes.ts
```

Expected output: lines like `[BACKFILL] Assigned code XXXXXXXXXX to user <id>` for any users without a code.

- [ ] **Step 2: End-to-end test — referral flow**

1. Get your referral link from `/referral` or `/profile`
2. Open the link in an incognito window: `http://localhost:3000/signup?ref=<YOUR_CODE>`
3. Sign up with a new phone number
4. In Drizzle Studio (`npx drizzle-kit studio`): check the `referral` table — a row should exist with `status = 'pending'` and your user ID as `referrer_id`
5. Back in your main session, open `/referral` — the pending count should now show `1`

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: verify referral system end-to-end"
```
