-- ============================================================================
-- Database Security & Performance Optimization Migration v2
-- ============================================================================
-- Fixed version with proper table/column name casing
-- ============================================================================

-- ============================================================================
-- PART 1: CRITICAL SECURITY IMPROVEMENTS
-- ============================================================================

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create immutability enforcement function
CREATE OR REPLACE FUNCTION prevent_immutable_table_changes()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Cannot modify immutable ledger table "%" via %', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- Apply immutability trigger to transaction table
DROP TRIGGER IF EXISTS transaction_immutable ON "transaction";
CREATE TRIGGER transaction_immutable
    BEFORE UPDATE OR DELETE ON "transaction"
    FOR EACH ROW EXECUTE FUNCTION prevent_immutable_table_changes();

-- Apply immutability trigger to audit_log
DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;
CREATE TRIGGER audit_log_immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_immutable_table_changes();

-- ============================================================================
-- PART 2: PERFORMANCE - ADD CRITICAL MISSING INDEXES
-- ============================================================================

-- Admin dashboard: recent deposits/withdrawals
CREATE INDEX IF NOT EXISTS deposit_status_created_idx ON deposit(status, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawal_status_created_idx ON withdrawal(status, created_at DESC);

-- VIP tier queries: high-value users (quote "user" as it's a reserved keyword)
CREATE INDEX IF NOT EXISTS user_vip_balance_idx ON "user"(vip_level, balance DESC);

-- Referral analytics: pending referrals
CREATE INDEX IF NOT EXISTS referral_status_created_idx ON referral(status, created_at DESC);

-- Bonus expiration cleanup (use proper table name)
CREATE INDEX IF NOT EXISTS user_bonus_status_expires_idx ON user_bonus(status, expires_at);

-- Fraud detection: rapid transaction lookup
CREATE INDEX IF NOT EXISTS transaction_type_status_created_idx ON "transaction"(type, status, created_at DESC);

-- Covering index for balance history (use snake_case column names)
CREATE INDEX IF NOT EXISTS transaction_user_balance_covering ON "transaction"(user_id, created_at)
    INCLUDE (balance_before, balance_after, amount, status);

-- Game session lookup optimization
CREATE INDEX IF NOT EXISTS game_session_user_status_idx ON game_session(user_id, status, started_at DESC);

-- Bet settlement performance
CREATE INDEX IF NOT EXISTS bet_result_created_idx ON bet(result, created_at DESC)
    WHERE result = 'pending';

-- ============================================================================
-- PART 3: RATE LIMITING INFRASTRUCTURE
-- ============================================================================

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS rate_limit (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT NOW(),
    window_end TIMESTAMP GENERATED ALWAYS AS (window_start + INTERVAL '1 minute') STORED,
    UNIQUE(user_id, action, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limit_user_action_idx ON rate_limit(user_id, action, window_start);

-- Rate limit check function (returns true if rate limited)
CREATE OR REPLACE FUNCTION check_rate_limit(p_user_id TEXT, p_action TEXT, p_max_attempts INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Clean old entries
    DELETE FROM rate_limit WHERE window_start < NOW() - INTERVAL '1 hour';

    -- Get current count
    SELECT COALESCE(MAX(count), 0) INTO v_count
    FROM rate_limit
    WHERE user_id = p_user_id
        AND action = p_action
        AND window_start > NOW() - INTERVAL '1 minute';

    -- Check if rate limited
    IF v_count >= p_max_attempts THEN
        RETURN TRUE;  -- Rate limited
    END IF;

    -- Increment or create counter
    INSERT INTO rate_limit (user_id, action, count)
    VALUES (p_user_id, p_action, 1)
    ON CONFLICT (user_id, action, window_start)
    DO UPDATE SET count = rate_limit.count + 1;

    RETURN FALSE;  -- Not rate limited
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 4: MONITORING VIEWS
-- ============================================================================

-- Balance reconciliation view (use snake_case and quoted "user")
CREATE OR REPLACE VIEW balance_reconciliation AS
SELECT
    u.id,
    u.email,
    u.balance AS cached_balance,
    COALESCE(
        (SELECT SUM(amount)
         FROM "transaction" t
         WHERE t.user_id = u.id AND t.status = 'completed'),
        '0'
    )::NUMERIC(18,2) AS calculated_balance,
    u.balance - COALESCE(
        (SELECT SUM(amount)
         FROM "transaction" t
         WHERE t.user_id = u.id AND t.status = 'completed'),
        '0'
    )::NUMERIC(18,2) AS drift
FROM "user" u;

-- Pending operations view
CREATE OR REPLACE VIEW pending_operations AS
SELECT
    'pending_deposits' AS operation_type,
    COUNT(*) AS count,
    SUM(amount)::NUMERIC(18,2) AS total_amount
FROM deposit WHERE status = 'pending'
UNION ALL
SELECT
    'pending_withdrawals' AS operation_type,
    COUNT(*) AS count,
    SUM(amount)::NUMERIC(18,2) AS total_amount
FROM withdrawal WHERE status = 'pending'
UNION ALL
SELECT
    'pending_bets' AS operation_type,
    COUNT(*) AS count,
    SUM(amount)::NUMERIC(18,2) AS total_amount
FROM bet WHERE result = 'pending'
UNION ALL
SELECT
    'active_bonuses' AS operation_type,
    COUNT(*) AS count,
    SUM(wagering_required - wagering_completed)::NUMERIC(18,2) AS total_amount
FROM user_bonus WHERE status = 'active';

-- ============================================================================
-- PART 5: SECURITY AUDIT FUNCTIONS
-- ============================================================================

-- Function to log all admin actions (called from application)
CREATE OR REPLACE FUNCTION log_admin_action(
    p_actor_id TEXT,
    p_actor_role TEXT,
    p_action TEXT,
    p_target_type TEXT,
    p_target_id TEXT,
    p_before JSONB DEFAULT NULL,
    p_after JSONB DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_log_id TEXT;
BEGIN
    v_log_id := gen_random_uuid()::TEXT;

    INSERT INTO audit_log (
        id, actor_id, actor_role, action,
        target_type, target_id, before, after,
        ip_address, user_agent
    ) VALUES (
        v_log_id, p_actor_id, p_actor_role, p_action,
        p_target_type, p_target_id, p_before, p_after,
        p_ip_address, p_user_agent
    );

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify immutability triggers are in place
SELECT
    schemaname,
    tablename,
    triggername
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE triggername IN ('transaction_immutable', 'audit_log_immutable');

-- Verify new indexes were created
SELECT
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE indexname IN (
    'deposit_status_created_idx',
    'withdrawal_status_created_idx',
    'user_vip_balance_idx',
    'referral_status_created_idx',
    'user_bonus_status_expires_idx',
    'transaction_type_status_created_idx',
    'transaction_user_balance_covering',
    'game_session_user_status_idx',
    'bet_result_created_idx'
);
