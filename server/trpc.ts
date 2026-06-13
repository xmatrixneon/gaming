/**
 * tRPC Server Setup
 * Initializes tRPC with Better Auth context
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { type Context } from "./context";
import superjson from "superjson";
import { ZodError } from "zod";

// ============================================================================
// tRPC INITIALIZATION
// ============================================================================

/**
 * tRPC instance with context and error formatting
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

// ============================================================================
// PROCEDURE BUILDERS
// ============================================================================

/**
 * Public procedure - accessible without authentication
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 * Throws UNAUTHORIZED error if no session exists
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      // Infers that session and user are non-null
      session: ctx.session,
      user: ctx.user,
    },
  });
});

/**
 * Admin procedure — requires the caller's user ID to be in ADMIN_USER_IDS env var.
 * Set ADMIN_USER_IDS=id1,id2 in .env.local. Until a role column is added to the
 * schema this is the authoritative admin check for all sensitive operations.
 */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  const adminIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!adminIds.includes(ctx.user.id)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.user,
    },
  });
});

// ============================================================================
// EXPORTS
// ============================================================================

export const middleware = t.middleware;
export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
