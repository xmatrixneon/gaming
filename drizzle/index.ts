/**
 * Database connection and Drizzle client setup
 * Uses PostgreSQL with postgres driver
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

/**
 * Create PostgreSQL connection
 * Connection string from environment variable or defaults to localhost
 */
const connectionString = process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/clausbet";

/**
 * PostgreSQL client with connection pooling
 */
const client = postgres(connectionString, {
  max: 10, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
});

/**
 * Drizzle ORM instance with schema for type-safe queries
 * Use this for all database operations
 */
export const db = drizzle(client, { schema });

/**
 * Close database connection
 * Call this when shutting down the application
 */
export async function closeDatabase() {
  await client.end();
}

// ============================================================================
// EXPORTS
// ============================================================================

export * from "./schema";
