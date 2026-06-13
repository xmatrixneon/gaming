# Referral System — Design Spec

**Date:** 2026-06-13  
**Status:** Approved

## What's already built

The backend is complete and correct:
- `lib/referral-service.ts` — `generateCode()`, `createReferralOnSignup()`, `qualifyReferral()`, `getStats()`
- `server/routers/referral.ts` — `getReferralCode`, `getReferralStats`, `getReferralHistory` tRPC procedures
- `drizzle/schema.ts` — `referral` table with status enum, indexes, self-referral CHECK constraint
- `server/routers/transaction.ts` — calls `qualifyReferral()` on first deposit ✓

## What's missing (three gaps)

### Gap 1 — Referral code never assigned on signup
`user.referralCode` stays `null` after signup. `referralService.generateCode()` is never called.

**Fix:** Use Better Auth's `hooks.after` middleware. Check `ctx.path.startsWith("/sign-up")` and `ctx.context.newSession`. If a new session exists and the user has no referral code yet, call `referralService.generateCode()` and `db.update(user).set({ referralCode })`. Runs for both phone and Google OAuth signups.

### Gap 2 — Signup page ignores `?ref=` query param
`createReferralOnSignup()` is never called. The signup URL `?ref=XYZ` is silently discarded.

**Fix:**
1. Signup page reads `useSearchParams()` for `ref` value and stores it in a React ref (persists across OTP steps without re-renders).
2. After phone is verified and the session is active, call a new tRPC mutation `referral.applyReferralCode` that calls `createReferralOnSignup()` server-side (has access to IP from request headers).
3. Google OAuth: store `ref` in a cookie before redirecting, read it back in the OAuth callback route and call the same mutation.

### Gap 3 — No referral UI
Profile page has query hooks and handlers for referral data but renders nothing. No `/referral` page exists.

**Fix:** Two pieces of UI (see Design section below).

## UI Design

### Profile page — Referral card

Inserted between the user profile card and the "Security & Settings" section. Uses shadcn CSS variables only (no hardcoded colors).

```
┌─────────────────────────────────────────┐
│ 🎁 Refer & Earn              View All → │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Your Code                           │ │
│ │ XK9F2M4A        [📋 Copy] [↗ Share] │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │    3     │ │   ₹600   │ │    1     │ │
│ │REFERRALS │ │  EARNED  │ │ PENDING  │ │
│ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────┘
```

- "View All →" links to `/referral`
- Copy copies the share link (`NEXT_PUBLIC_APP_URL/signup?ref=CODE`)
- Share uses `navigator.share` (Web Share API) with fallback to copy

### `/referral` page

Full-page referral dashboard with:
1. **Header** — AppHeader + back navigation
2. **Code card** — same as profile card (code, copy, share, tagline "Earn 10% of your friend's first deposit, up to ₹2,000")
3. **Stats row** — Referrals rewarded / Total earned / Pending
4. **History list** — table of referred users (masked: first 3 chars + ***), date joined, status badge (Pending / Rewarded), bonus amount
5. **Empty state** — friendly message when no referrals yet

## Data flow

```
User visits /signup?ref=XYZ
  → ref stored in React ref
  → Phone verified → session created
  → handleSubmit calls referral.applyReferralCode(code)
    → referralService.createReferralOnSignup(userId, code, ip, email)
      → inserts referral row with status='pending'

User's friend makes first deposit
  → transaction.ts calls referralService.qualifyReferral()
    → credits referrer's balance
    → sets referral.status='rewarded'
    → invalidates referral_stats Redis cache

Profile page / /referral page
  → api.referral.getReferralCode.useQuery()     → code + shareLink
  → api.referral.getReferralStats.useQuery()    → pending/rewarded/totalEarnings
  → api.referral.getReferralHistory.useQuery()  → list of referral rows
```

## Files to create/modify

| Action   | File                                        | What changes |
|----------|---------------------------------------------|--------------|
| Modify   | `lib/auth.ts`                               | Add `databaseHooks.user.create.after` to assign referral code |
| Add      | `server/routers/referral.ts`                | Add `applyReferralCode` mutation |
| Modify   | `app/signup/page.tsx`                       | Read `?ref=` param, call mutation after verify |
| Modify   | `app/profile/page.tsx`                      | Add referral card section to JSX |
| Create   | `app/referral/page.tsx`                     | Dedicated referral page |
| Modify   | `app/more/page.tsx`                         | Add "Refer & Earn" link if page exists |

## Out of scope

- Referral leaderboard / tiered rewards
- Multi-level referrals
- Google OAuth referral attribution (cookie path) — implement only phone signup path for now; note the gap in code
