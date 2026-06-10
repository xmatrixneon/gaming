/**
 * Deposit Router
 * Public procedures for deposit-related queries
 */

import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { gatewaySelector } from '@/lib/gateway-selector';

export const depositRouter = router({
  /**
   * Get available deposit gateways
   * Returns enabled gateways for display on deposit page
   */
  getAvailableGateways: publicProcedure
    .query(async () => {
      try {
        const gateways = await gatewaySelector.getAvailableGateways();
        return {
          success: true,
          gateways,
        };
      } catch (error) {
        console.error('[DEPOSIT] Failed to get available gateways:', error);
        return {
          success: false,
          gateways: [],
          error: 'Failed to load payment options',
        };
      }
    }),
});
