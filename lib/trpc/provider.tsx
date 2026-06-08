/**
 * tRPC Provider Component for Next.js 16
 *
 * Wrap your app with this provider to enable tRPC functionality.
 * Should be placed near the root of your app, below other providers.
 */

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import { api, trpcClientOptions } from "./client";

/**
 * Props for the tRPC Provider
 */
export interface TRPCProviderProps {
  /**
   * Child components that will have access to tRPC
   */
  children: ReactNode;

  /**
   * Whether to show React Query DevTools
   * @default true in development, false in production
   */
  showDevTools?: boolean;
}

/**
 * tRPC Provider Component
 *
 * Wraps the app with necessary providers for tRPC and React Query.
 * Creates a QueryClient instance per request to prevent cache sharing.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { TRPCProvider } from '@/lib/trpc/provider'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <TRPCProvider>
 *           {children}
 *         </TRPCProvider>
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */
export function TRPCProvider({
  children,
  showDevTools = process.env.NODE_ENV === "development",
}: TRPCProviderProps) {
  /**
   * Create a new QueryClient instance for each request
   * This prevents cache sharing between requests
   */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            ...trpcClientOptions.queryClientConfig?.defaultOptions?.queries,
            /**
             * Refetch on window focus is disabled by default
             * Enable it selectively per query if needed
             */
            refetchOnWindowFocus: false,
          },
          mutations: {
            ...trpcClientOptions.queryClientConfig?.defaultOptions?.mutations,
          },
        },
      })
  );

  /**
   * Create tRPC client with the QueryClient
   */
  const [trpcClient] = useState(() =>
    api.createClient({
      ...trpcClientOptions,
      // React Query will be provided by the QueryClientProvider
    })
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        {showDevTools && (
          <ReactQueryDevtools
            initialIsOpen={false}
          />
        )}
      </QueryClientProvider>
    </api.Provider>
  );
}
