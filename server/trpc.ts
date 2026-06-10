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
 * Admin procedure - requires admin role
 * TODO: Implement role-based access control
 */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  // TODO: Check admin role
  // if (ctx.user.role !== "admin") {
  //   throw new TRPCError({
  //     code: "FORBIDDEN",
  //     message: "You must be an admin to access this resource",
  //   });
  // }

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
