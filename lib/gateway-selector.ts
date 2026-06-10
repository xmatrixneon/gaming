/**
 * Gateway Selector Service
 *
 * Main service for selecting and routing to payment gateways.
 * Reads configuration from database with Redis caching.
 */

import { db } from '@/drizzle';
import { paymentGatewayConfig } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { velopayGateway } from './velopay-gateway';
import { okpayGateway } from './okpay-gateway';
import * as gatewayCache from './gateway-cache';

export interface GatewayOption {
  id: '1' | '2';
  displayName: string;
  gatewayName: 'velopay' | 'okpay';
  enabled: boolean;
  status: 'active' | 'maintenance' | 'disabled';
}

class GatewaySelector {
  private initialized = false;

  /**
   * Initialize gateway selector - warm cache on startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const configs = await db.select().from(paymentGatewayConfig);
      await gatewayCache.warmGatewayCache(configs as any);
      this.initialized = true;
      console.log('[GATEWAY_SELECTOR] Initialized with', configs.length, 'gateways');
    } catch (error) {
      console.error('[GATEWAY_SELECTOR] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get available gateways for deposit page display
   * Returns enabled gateways sorted by priority
   */
  async getAvailableGateways(): Promise<GatewayOption[]> {
    await this.ensureInitialized();

    const configs = await gatewayCache.getAllEnabledGateways();

    // Filter out maintenance/disabled gateways
    const activeConfigs = configs.filter(c => c.status === 'active');

    // If only one gateway, show as single "UPI" option
    if (activeConfigs.length === 1) {
      return [{
        id: '1',
        displayName: 'UPI',
        gatewayName: activeConfigs[0].gatewayName,
        enabled: true,
        status: activeConfigs[0].status,
      }];
    }

    // Map to UPI 1 / UPI 2 format
    return activeConfigs.map((config, index) => ({
      id: (index + 1).toString() as '1' | '2',
      displayName: config.displayName,
      gatewayName: config.gatewayName,
      enabled: config.enabled,
      status: config.status,
    }));
  }

  /**
   * Get gateway instance by priority selection (1 = UPI 1, 2 = UPI 2)
   */
  async getGatewayByPriority(priority: 1 | 2): Promise<typeof velopayGateway | typeof okpayGateway> {
    await this.ensureInitialized();

    const config = await gatewayCache.getGatewayByPriority(priority);

    if (!config) {
      throw new Error(`No gateway configured for priority ${priority}`);
    }

    if (config.status !== 'active') {
      throw new Error(`Gateway ${config.displayName} is currently ${config.status}`);
    }

    // Return the appropriate gateway instance
    switch (config.gatewayName) {
      case 'velopay':
        return velopayGateway;
      case 'okpay':
        return okpayGateway;
      default:
        throw new Error(`Unknown gateway: ${config.gatewayName}`);
    }
  }

  /**
   * Get gateway config by ID
   */
  async getGatewayConfig(id: string): Promise<any> {
    await this.ensureInitialized();

    const config = await db
      .select()
      .from(paymentGatewayConfig)
      .where(eq(paymentGatewayConfig.id, id))
      .limit(1);

    return config[0] || null;
  }

  /**
   * Refresh gateway config from database and invalidate cache
   */
  async refreshConfig(id?: string): Promise<void> {
    if (id) {
      // Refresh specific gateway
      const config = await db
        .select()
        .from(paymentGatewayConfig)
        .where(eq(paymentGatewayConfig.id, id))
        .limit(1);

      if (config[0]) {
        await gatewayCache.setGatewayConfig(id, config[0] as any);
      }
    } else {
      // Refresh all gateways
      const configs = await db.select().from(paymentGatewayConfig);
      await gatewayCache.invalidateAllGatewayCache();
      await gatewayCache.warmGatewayCache(configs as any);
    }
  }

  /**
   * Ensure selector is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

export const gatewaySelector = new GatewaySelector();

// Initialize on module load (in production)
if (process.env.NODE_ENV === 'production') {
  gatewaySelector.initialize().catch(console.error);
}
