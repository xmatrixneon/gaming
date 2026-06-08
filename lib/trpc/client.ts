/**
 * tRPC Client Configuration for Next.js 16
 *
 * This file sets up the tRPC client with proper TypeScript inference
 * from the server API router. All API calls go through this client.
 */

import { createTRPCReact, httpBatchLink, loggerLink } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { SuperJSON } from "superjson";
import type { AppRouter } from "@/server/routers";

/**
 * tRPC React hooks with full type inference from the server
 *
 * @example
 * ```tsx
 * const { data } = api.game.get.useQuery({ id: "123" });
 * const mutation = api.user.update.useMutation();
 * ```
 */
export const api = createTRPCReact<AppRouter>();

/**
 * Configure how tRPC transforms data between client and server
 * Using SuperJSON for Date, BigInt, and other complex type handling
 */
export const transformer = new SuperJSON();

/**
 * tRPC client configuration options
 */
export const trpcClientOptions = {
  /**
   * Custom links for request/response handling
   *
   * Links are composable middleware for tRPC requests
   * Order: loggerLink → httpBatchLink
   */
  links: [
    // Add logging in development
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === "development" ||
        (opts.direction === "down" && opts.result instanceof Error),
    }),

    /**
     * HTTP batch link for making requests to the tRPC API
     * Uses SuperJSON for data serialization (tRPC v11 requires transformer on link)
     *
     * Better Auth Integration: Include session cookies from auth client
     * Following Better Auth best practices for Next.js + tRPC
     */
    httpBatchLink({
      url: process.env.NEXT_PUBLIC_TRPC_URL || "/api/trpc",
      transformer: transformer,
    }),
  ],

  /**
   * QueryClient configuration for React Query integration
   */
  queryClientConfig: {
    defaultOptions: {
      queries: {
        /**
         * Time in ms that data remains fresh
         * 5 minutes default, adjust per query as needed
         */
        staleTime: 5 * 60 * 1000,

        /**
         * Time in ms before inactive queries are garbage collected
         * 10 minutes default
         */
        gcTime: 10 * 60 * 1000,

        /**
         * Retry failed requests
         */
        retry: (failureCount: number, error: any) => {
          // Don't retry on 4xx errors (client errors)
          if (error?.data?.httpStatus >= 400 && error?.data?.httpStatus < 500) {
            return false;
          }
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },

        /**
         * Refetch on window focus (optional, can be disabled)
         */
        refetchOnWindowFocus: false,

        /**
         * Refetch on reconnect
         */
        refetchOnReconnect: true,
      },
      mutations: {
        /**
         * Retry mutations
         */
        retry: (failureCount: number, error: any) => {
          // Don't retry mutations on 4xx errors
          if (error?.data?.httpStatus >= 400 && error?.data?.httpStatus < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  },
};

/**
 * Type-safe API path helper for getting inferred types
 *
 * @example
 * ```typescript
 * type Game = RouterOutputs["game"]["get"];
 * type UserInput = RouterInputs["user"]["update"];
 * ```
 */
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

/**
 * Utility hook for getting typed API client
 * Wraps the api.createClient() with proper configuration
 */
export function useTRPCClient() {
  return api.createClient(trpcClientOptions);
}
