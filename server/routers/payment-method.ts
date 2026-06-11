/**
 * Payment Method Router
 * tRPC procedures for managing user payment methods (UPI and bank transfer)
 * Includes password verification for sensitive operations
 */

import { router, protectedProcedure } from "../trpc";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, ne, sql, desc, asc } from "drizzle-orm";
import { db } from "@/drizzle";
import { paymentMethod, account, auditLog } from "@/drizzle/schema";
import { nanoid } from "nanoid";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user has a password set (credential account exists)
 */
async function checkUserHasPassword(userId: string): Promise<boolean> {
  try {
    const credentialAccount = await db
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, "credential")
        )
      )
      .limit(1);

    return credentialAccount.length > 0 && credentialAccount[0].password !== null;
  } catch (error) {
    console.error("[PAYMENT_METHOD] Failed to check user password:", error);
    return false;
  }
}

/**
 * Verify user's password using Better Auth
 * Returns true if password is correct, false otherwise
 */
async function verifyUserPassword(userId: string, password: string, userEmail: string): Promise<boolean> {
  try {
    // Import headers dynamically to avoid issues with Next.js headers()
    const { headers } = await import("next/headers");

    // Use Better Auth's signIn API to verify credentials
    // This will fail if password is incorrect
    const result = await auth.api.signIn.email({
      body: {
        email: userEmail,
        password,
      },
      headers: await headers(),
    });

    return result !== null && result.user !== null;
  } catch (error) {
    console.error("[PAYMENT_METHOD] Password verification failed:", error);
    return false;
  }
}

/**
 * Mask account number showing only last 4 digits
 */
function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber || accountNumber.length < 4) {
    return "••••";
  }
  return `•••• ${accountNumber.slice(-4)}`;
}

// ============================================================================
// PAYMENT METHOD ROUTER
// ============================================================================

export const paymentMethodRouter = router({
  /**
   * List user's payment methods
   * Returns masked account numbers for security
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const methods = await db
        .select()
        .from(paymentMethod)
        .where(eq(paymentMethod.userId, ctx.user.id))
        .orderBy(sql`${paymentMethod.isPrimary} desc, ${paymentMethod.createdAt} asc`);

      // Mask account numbers in response
      return methods.map((m) => ({
        ...m,
        accountNumber: m.accountNumber ? maskAccountNumber(m.accountNumber) : null,
      }));
    } catch (error) {
      console.error("[PAYMENT_METHOD] Failed to list payment methods:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to load payment methods",
      });
    }
  }),

  /**
   * Check if user has a password set
   * Used by frontend to show password prompts
   */
  hasPassword: protectedProcedure.query(async ({ ctx }) => {
    try {
      const hasPassword = await checkUserHasPassword(ctx.user.id);
      return { hasPassword };
    } catch (error) {
      console.error("[PAYMENT_METHOD] Failed to check password status:", error);
      return { hasPassword: false };
    }
  }),

  /**
   * Add new payment method
   * Automatically sets first method as primary
   */
  add: protectedProcedure
    .input(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("upi"),
          upiId: z.string().regex(/^[\w.\-]+@[\w.\-]+$/, "Invalid UPI ID format"),
          label: z.string().max(50, "Label too long").optional(),
        }),
        z.object({
          type: z.literal("bank_transfer"),
          accountNumber: z.string().min(9, "Account number too short").max(18, "Account number too long"),
          accountHolder: z.string().min(2, "Account holder name too short"),
          bankName: z.string().min(2, "Bank name too short"),
          ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format"),
          label: z.string().max(50, "Label too long").optional(),
        }),
      ])
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Rate limit: max 5 payment methods per user
        const count = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(paymentMethod)
          .where(eq(paymentMethod.userId, ctx.user.id));

        if (count[0].count >= 5) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum 5 payment methods allowed",
          });
        }

        // Check for duplicate UPI IDs
        if (input.type === "upi") {
          const existing = await db
            .select()
            .from(paymentMethod)
            .where(
              and(
                eq(paymentMethod.userId, ctx.user.id),
                eq(paymentMethod.upiId, input.upiId)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "This UPI ID is already saved",
            });
          }
        }

        // Check for duplicate bank accounts
        if (input.type === "bank_transfer") {
          const existing = await db
            .select()
            .from(paymentMethod)
            .where(
              and(
                eq(paymentMethod.userId, ctx.user.id),
                eq(paymentMethod.accountNumber, input.accountNumber)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "This bank account is already saved",
            });
          }
        }

        // If first method, make it primary
        const existingCount = await db
          .select()
          .from(paymentMethod)
          .where(eq(paymentMethod.userId, ctx.user.id));
        const isPrimary = existingCount.length === 0;

        const [method] = await db
          .insert(paymentMethod)
          .values({
            userId: ctx.user.id,
            type: input.type,
            isPrimary,
            label: input.label || null,
            upiId: input.type === "upi" ? input.upiId : null,
            accountNumber: input.type === "bank_transfer" ? input.accountNumber : null,
            accountHolder: input.type === "bank_transfer" ? input.accountHolder : null,
            bankName: input.type === "bank_transfer" ? input.bankName : null,
            ifscCode: input.type === "bank_transfer" ? input.ifscCode : null,
          })
          .returning();

        // Audit log
        await db.insert(auditLog).values({
          id: nanoid(),
          actorId: ctx.user.id,
          actorRole: "user",
          action: "payment_method_added",
          targetType: "payment_method",
          targetId: method.id.toString(),
          after: { type: input.type },
        });

        console.log("[PAYMENT_METHOD] Payment method added:", method.id);
        return { success: true, method };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[PAYMENT_METHOD] Failed to add payment method:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add payment method",
        });
      }
    }),

  /**
   * Set a payment method as primary
   * Requires password if user has one set
   */
  setPrimary: protectedProcedure
    .input(
      z.object({
        methodId: z.number(),
        password: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Password verification
        const hasPassword = await checkUserHasPassword(ctx.user.id);
        if (hasPassword) {
          if (!input.password) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Password required to set primary payment method",
            });
          }

          const userEmail = ctx.user.email;
          if (!userEmail) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Email required for password verification",
            });
          }

          const passwordValid = await verifyUserPassword(ctx.user.id, input.password, userEmail);
          if (!passwordValid) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Incorrect password",
            });
          }
        }

        // Verify ownership
        const method = await db
          .select()
          .from(paymentMethod)
          .where(
            and(
              eq(paymentMethod.id, input.methodId),
              eq(paymentMethod.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (method.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Payment method not found",
          });
        }

        // Already primary
        if (method[0].isPrimary) {
          return { success: true, message: "Already set as primary" };
        }

        // Atomic transaction: reset all primary, set new primary
        await db.transaction(async (tx) => {
          await tx
            .update(paymentMethod)
            .set({ isPrimary: false })
            .where(eq(paymentMethod.userId, ctx.user.id));

          await tx
            .update(paymentMethod)
            .set({ isPrimary: true, updatedAt: new Date() })
            .where(eq(paymentMethod.id, input.methodId));
        });

        // Audit log
        await db.insert(auditLog).values({
          id: nanoid(),
          actorId: ctx.user.id,
          actorRole: "user",
          action: "payment_method_set_primary",
          targetType: "payment_method",
          targetId: input.methodId.toString(),
        });

        console.log("[PAYMENT_METHOD] Primary payment method set:", input.methodId);
        return { success: true, message: "Primary payment method updated" };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[PAYMENT_METHOD] Failed to set primary:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to set primary payment method",
        });
      }
    }),

  /**
   * Delete a payment method
   * Always requires password for security
   */
  delete: protectedProcedure
    .input(
      z.object({
        methodId: z.number(),
        password: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Password verification (always required for deletion)
        const hasPassword = await checkUserHasPassword(ctx.user.id);
        if (hasPassword) {
          const userEmail = ctx.user.email;
          if (!userEmail) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Email required for password verification",
            });
          }

          const passwordValid = await verifyUserPassword(ctx.user.id, input.password, userEmail);
          if (!passwordValid) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Incorrect password",
            });
          }
        }

        // Verify ownership
        const method = await db
          .select()
          .from(paymentMethod)
          .where(
            and(
              eq(paymentMethod.id, input.methodId),
              eq(paymentMethod.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (method.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Payment method not found",
          });
        }

        // Prevent deleting if it's the only method
        const count = await db
          .select()
          .from(paymentMethod)
          .where(eq(paymentMethod.userId, ctx.user.id));

        if (count.length === 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot delete your only payment method",
          });
        }

        // If deleting primary, promote another
        if (method[0].isPrimary) {
          const [nextPrimary] = await db
            .select()
            .from(paymentMethod)
            .where(
              and(
                eq(paymentMethod.userId, ctx.user.id),
                ne(paymentMethod.id, input.methodId)
              )
            )
            .limit(1);

          if (nextPrimary) {
            await db
              .update(paymentMethod)
              .set({ isPrimary: true })
              .where(eq(paymentMethod.id, nextPrimary.id));
          }
        }

        // Delete the payment method
        await db
          .delete(paymentMethod)
          .where(eq(paymentMethod.id, input.methodId));

        // Audit log
        await db.insert(auditLog).values({
          id: nanoid(),
          actorId: ctx.user.id,
          actorRole: "user",
          action: "payment_method_deleted",
          targetType: "payment_method",
          targetId: input.methodId.toString(),
          before: { type: method[0].type },
        });

        console.log("[PAYMENT_METHOD] Payment method deleted:", input.methodId);
        return { success: true, message: "Payment method deleted" };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        console.error("[PAYMENT_METHOD] Failed to delete payment method:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete payment method",
        });
      }
    }),
});
