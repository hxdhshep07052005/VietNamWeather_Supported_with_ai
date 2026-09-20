-- Phase 10 & Phase 11 Database Schema Migration
-- Defines persistent tables for Subscriptions, Payments, and AI Chat Conversations

BEGIN;

-- =============================================================================
-- SUBSCRIPTIONS TABLE (Phase 10: Monetization & Entitlements)
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
    plan VARCHAR(32) NOT NULL DEFAULT 'free',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    interval VARCHAR(16) NOT NULL DEFAULT 'month',
    provider VARCHAR(32) NOT NULL DEFAULT 'manual',
    customer_id VARCHAR(128),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE subscriptions IS 'Stores active, past_due, canceled user subscription state for Phase 10 billing';

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status);
CREATE INDEX IF NOT EXISTS subscriptions_customer_idx ON subscriptions (customer_id);

-- =============================================================================
-- PAYMENT RECORDS TABLE (Phase 10: Payment Transactions & Invoices)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_records (
    id VARCHAR(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,
    transaction_id VARCHAR(128) NOT NULL,
    order_id VARCHAR(128) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'VND',
    status VARCHAR(32) NOT NULL,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE payment_records IS 'Immutable transaction ledger for Stripe and VNPay checkout payments';

CREATE INDEX IF NOT EXISTS payment_records_user_idx ON payment_records (user_id);
CREATE INDEX IF NOT EXISTS payment_records_txn_idx ON payment_records (transaction_id);
CREATE INDEX IF NOT EXISTS payment_records_order_idx ON payment_records (order_id);

-- =============================================================================
-- CHAT CONVERSATIONS TABLE (Phase 11: AI Chatbot)
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_conversations (
    id VARCHAR(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    locale VARCHAR(10) NOT NULL DEFAULT 'vi',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE chat_conversations IS 'Tracks AI assistant conversation sessions per user';

CREATE INDEX IF NOT EXISTS chat_conversations_user_idx ON chat_conversations (user_id);

-- =============================================================================
-- CHAT MESSAGES TABLE (Phase 11: Grounded Citations & Audit)
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES directus_users(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL,
    content TEXT NOT NULL,
    citations JSONB,
    disclaimer TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE chat_messages IS 'Message history and grounding audit trail for AI assistant';

CREATE INDEX IF NOT EXISTS chat_messages_conv_idx ON chat_messages (conversation_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON chat_messages (user_id);

-- =============================================================================
-- ROLE GRANTS
-- =============================================================================

DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vnwa_api') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO vnwa_api;
        GRANT SELECT, INSERT, UPDATE ON payment_records TO vnwa_api;
        GRANT SELECT, INSERT, UPDATE, DELETE ON chat_conversations TO vnwa_api;
        GRANT SELECT, INSERT, UPDATE, DELETE ON chat_messages TO vnwa_api;
    END IF;
END
$do$;

COMMIT;
