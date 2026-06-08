/**
 * tRPC Type Definitions and Utilities
 *
 * This file exports TypeScript types and utilities for working with tRPC.
 * These types provide full type safety between client and server.
 */

import type { TRPCClientErrorLike } from "@trpc/client";
import type { ZodError } from "zod";

/**
 * Extract the output type of a procedure
 *
 * @example
 * ```typescript
 * type GameOutput = ProcedureOutput<typeof appRouter.game.get>;
 * ```
 */
export type ProcedureOutput<TProcedure> = TProcedure extends {
  _def: {
    _output_out: infer TOutput;
  };
}
  ? TOutput
  : never;

/**
 * Extract the input type of a procedure
 *
 * @example
 * ```typescript
 * type GameInput = ProcedureInput<typeof appRouter.game.get>;
 * ```
 */
export type ProcedureInput<TProcedure> = TProcedure extends {
  _def: {
    _input_in: infer TInput;
  };
}
  ? TInput
  : never;

/**
 * Infer the error shape from tRPC
 *
 * @example
 * ```typescript
 * try {
 *   await api.user.update.mutate({ name: "John" });
 * } catch (error) {
 *   const trpcError = error as TRPCError;
 *   console.error(trpcError.message);
 * }
 * ```
 */
export type TRPCError = TRPCClientErrorLike<any>;

/**
 * Shape of errors returned by tRPC
 */
export type TRPCErrorResponse = {
  code: number;
  message: string;
  data: {
    code: string;
    httpStatus: number;
    path?: string;
    stack?: string;
    zodError?: ZodError;
  };
};

/**
 * Standard API response wrapper type
 *
 * @example
 * ```typescript
 * type ApiResponse = APIResponse<Game>;
 * ```
 */
export type APIResponse<T> = {
  data: T;
  success: true;
} | {
  data: null;
  success: false;
  error: {
    message: string;
    code: string;
  };
};

/**
 * Paginated response type
 *
 * @example
 * ```typescript
 * type GamesResponse = PaginatedResponse<Game>;
 * ```
 */
export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/**
 * Mutation result type
 *
 * @example
 * ```typescript
 * type UpdateUserResult = MutationResult<User>;
 * ```
 */
export type MutationResult<T> = APIResponse<T> & {
  /**
   * Whether the mutation was successful
   */
  success: boolean;

  /**
   * The returned data if successful
   */
  data?: T;

  /**
   * Error message if failed
   */
  error?: string;
};

/**
 * Utility to check if an error is a tRPC error
 *
 * @example
 * ```typescript
 * try {
 *   await api.user.update.mutate({ name: "John" });
 * } catch (error) {
 *   if (isTRPCError(error)) {
 *     console.error(error.data.code);
 *   }
 * }
 * ```
 */
export function isTRPCError(error: unknown): error is TRPCError {
  return (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    "message" in error
  );
}

/**
 * Extract the error code from a tRPC error
 *
 * @example
 * ```typescript
 * try {
 *   await api.user.delete.mutate({ id: "123" });
 * } catch (error) {
 *   const code = getTRPCErrorCode(error);
 *   if (code === "UNAUTHORIZED") {
 *     // Redirect to login
 *   }
 * }
 * ```
 */
export function getTRPCErrorCode(error: unknown): string | null {
  if (isTRPCError(error)) {
    return error.data?.code ?? null;
  }
  return null;
}

/**
 * Extract the error message from a tRPC error
 *
 * @example
 * ```typescript
 * try {
 *   await api.user.create.mutate({ email: "test@example.com" });
 * } catch (error) {
 *   const message = getTRPCErrorMessage(error);
 *   toast.error(message);
 * }
 * ```
 */
export function getTRPCErrorMessage(error: unknown): string {
  if (isTRPCError(error)) {
    // Check for Zod validation errors
    if (error.data?.zodError) {
      const zodErrors = error.data.zodError.issues.map(
        (issue: any) => `${issue.path.join(".")}: ${issue.message}`
      );
      return zodErrors.join(", ");
    }
    return error.message;
  }
  return "An unexpected error occurred";
}
