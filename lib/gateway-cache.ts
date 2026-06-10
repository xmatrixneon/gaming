/**
 * Gateway Configuration Cache Service
 *
 * Redis-backed caching for payment gateway configurations.
 * Reduces database load and enables fast gateway lookups.
 */

import { redis } from './redis';

const CACHE_PREFIX = 'gateway_config';
const CACHE_TTL = 300; // 5 minutes

export interface CachedGatewayConfig {
  id: string;
  gatewayName: 'velopay' | 'okpay';
  displayName: string;
  enabled: boolean;
  priority: number;
  status: 'active' | 'maintenance' | 'disabled';
  configMetadata: {
    apiKey?: string;
    secret?: string;
    merchantId?: string;
    host?: string;
    callbackUrl?: string;
    mode?: 'sandbox' | 'production';
  };
}

/**
 * Get gateway config by ID from cache
 */
export async function getGatewayConfig(id: string): Promise<CachedGatewayConfig | null> {
  const key = `${CACHE_PREFIX}:id:${id}`;
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached) as CachedGatewayConfig;
  }

  return null;
}

/**
 * Cache gateway config by ID
 */
export async function setGatewayConfig(id: string, config: CachedGatewayConfig): Promise<void> {
  const key = `${CACHE_PREFIX}:id:${id}`;
  await redis.set(key, JSON.stringify(config), 'EX', CACHE_TTL);
}

/**
 * Get all enabled gateway configs from cache
 */
export async function getAllEnabledGateways(): Promise<CachedGatewayConfig[]> {
  const keys = await redis.keys(`${CACHE_PREFIX}:id:*`);
  const configs: CachedGatewayConfig[] = [];

  for (const key of keys) {
    const cached = await redis.get(key);
    if (cached) {
      const config = JSON.parse(cached) as CachedGatewayConfig;
      if (config.enabled) {
        configs.push(config);
      }
    }
  }

  return configs.sort((a, b) => a.priority - b.priority);
}

/**
 * Get gateway by priority (1 = UPI 1, 2 = UPI 2)
 */
export async function getGatewayByPriority(priority: 1 | 2): Promise<CachedGatewayConfig | null> {
  const gateways = await getAllEnabledGateways();
  return gateways.find(g => g.priority === priority) || null;
}

/**
 * Invalidate specific gateway cache
 */
export async function invalidateGateway(id: string): Promise<void> {
  const key = `${CACHE_PREFIX}:id:${id}`;
  await redis.del(key);
}

/**
 * Invalidate all gateway cache
 */
export async function invalidateAllGatewayCache(): Promise<void> {
  const keys = await redis.keys(`${CACHE_PREFIX}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

/**
 * Warm cache with all gateway configs from database
 */
export async function warmGatewayCache(configs: CachedGatewayConfig[]): Promise<void> {
  await Promise.all(
    configs.map(config => setGatewayConfig(config.id, config))
  );
}
