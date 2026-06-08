/**
 * Custom React hooks for common tRPC patterns
 *
 * These hooks provide convenient wrappers around tRPC and React Query
 * for common use cases like infinite queries, optimistic updates, etc.
 */

import { api } from "./client";
import type { QueryOptions } from "@tanstack/react-query";

/**
 * Hook for paginated lists with infinite scroll
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage } = useInfiniteList(
 *   api.game.infinite,
 *   { limit: 20 }
 * );
 * ```
 */
export function useInfiniteList<TProcedure extends any>(
  procedure: any,
  input: any,
  options?: QueryOptions
) {
  return procedure.infinite.useInfiniteQuery(
    input,
    {
      getNextPageParam: (lastPage: any) => lastPage.nextCursor,
      ...options,
    }
  );
}

/**
 * Hook for mutations with automatic success/error handling
 *
 * @example
 * ```tsx
 * const mutation = useMutationWithHandlers(
 *   api.user.update,
 *   {
 *     onSuccess: (data) => {
 *       toast.success("Profile updated!");
 *     },
 *     onError: (error) => {
 *       toast.error(error.message);
 *     }
 *   }
 * );
 * ```
 */
export function useMutationWithHandlers<TProcedure extends any>(
  procedure: any,
  handlers?: {
    onSuccess?: (data: any) => void;
    onError?: (error: any) => void;
  }
) {
  return procedure.useMutation({
    onSuccess: handlers?.onSuccess,
    onError: handlers?.onError,
  });
}

/**
 * Hook for cached queries with custom cache time
 *
 * @example
 * ```tsx
 * const { data } = useCachedQuery(
 *   api.game.get,
 *   { id: "123" },
 *   { staleTime: 1000 * 60 * 5 } // 5 minutes
 * );
 * ```
 */
export function useCachedQuery<TProcedure extends any>(
  procedure: any,
  input: any,
  cacheOptions?: {
    staleTime?: number;
    cacheTime?: number;
  }
) {
  return procedure.useQuery(input, {
    staleTime: cacheOptions?.staleTime ?? 1000 * 60 * 5, // 5 minutes default
    gcTime: cacheOptions?.cacheTime ?? 1000 * 60 * 10, // 10 minutes default
  });
}

/**
 * Hook for real-time subscriptions (Socket.IO integration)
 *
 * @example
 * ```tsx
 * const { data, subscribe } = useRealtimeSubscription(
 *   api.game.onUpdate
 * );
 *
 * useEffect(() => {
 *   const unsubscribe = subscribe({ gameId: "123" }, (update) => {
 *     console.log("Game update:", update);
 *   });
 *
 *   return unsubscribe;
 * }, []);
 * ```
 */
export function useRealtimeSubscription<TProcedure extends any>(
  procedure: any,
  enabled = true
) {
  // This would integrate with Socket.IO for real-time updates
  const subscription = procedure.useSubscription(
    {},
    {
      enabled,
    }
  );

  return {
    data: subscription.data,
    status: subscription.status,
    error: subscription.error,
  };
}

/**
 * Hook for optimistic updates using tRPC utils
 *
 * @example
 * ```tsx
 * const utils = api.useUtils();
 *
 * const mutation = useOptimisticMutation(
 *   api.user.update,
 *   utils,
 *   {
 *     getQueryData: (queryKey) => {
 *       return queryClient.getQueryData(queryKey);
 *     },
 *     setQueryData: (queryKey, newData) => {
 *       queryClient.setQueryData(queryKey, newData);
 *     }
 *   }
 * );
 * ```
 */
export function useOptimisticMutation<TProcedure extends any>(
  procedure: any,
  utils: any,
  config: {
    getQueryData: (queryKey: any[]) => any;
    setQueryData: (queryKey: any[], data: any) => void;
  }
) {
  return procedure.useMutation({
    onMutate: async (variables: any) => {
      // Cancel outgoing refetches
      // Note: The procedure should have a cancel method if it's a query hook
      // For mutations, you typically cancel related queries instead

      // Snapshot previous value - use a sensible query key based on the procedure
      // The caller should provide the query key structure
      const queryKey = [procedure._def?.path ?? 'unknown', variables];
      const previousData = config.getQueryData(queryKey);

      // Optimistically update
      config.setQueryData(queryKey, variables);

      // Return context with previous value
      return { previousData, queryKey };
    },
    onError: (err: any, variables: any, context: any) => {
      // Rollback on error
      if (context?.previousData && context?.queryKey) {
        config.setQueryData(context.queryKey, context.previousData);
      }
    },
  });
}

/**
 * Re-export common React Query hooks for convenience
 */
export { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
