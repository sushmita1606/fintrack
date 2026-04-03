-- FinTrack — PostgreSQL schema (Supabase / Neon compatible)
-- Run after creating database; extensions optional on managed Postgres.

-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Users (application profile; link to auth provider id if using OAuth)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255), -- NULL if OAuth-only
  name            VARCHAR(120),
  avatar_url      TEXT,
  google_id       VARCHAR(255) UNIQUE,
  theme_pref      VARCHAR(16) DEFAULT 'system' CHECK (theme_pref IN ('light', 'dark', 'system')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);

-- -----------------------------------------------------------------------------
-- Accounts (multi-account: cash, bank, UPI, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(32) NOT NULL CHECK (type IN ('cash', 'bank', 'credit', 'upi', 'wallet', 'other')),
  currency    VARCHAR(8) NOT NULL DEFAULT 'INR',
  balance     NUMERIC(18, 2) NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_user ON accounts (user_id) WHERE is_archived = FALSE;

-- -----------------------------------------------------------------------------
-- Categories (user-defined + optional system defaults per user)
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name        VARCHAR(80) NOT NULL,
  type        VARCHAR(16) NOT NULL CHECK (type IN ('income', 'expense')),
  icon        VARCHAR(64),
  color       VARCHAR(16),
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name, type)
);

CREATE INDEX idx_categories_user_type ON categories (user_id, type);

-- -----------------------------------------------------------------------------
-- Merchant / keyword hints for auto-categorization (optional ML later)
-- -----------------------------------------------------------------------------
CREATE TABLE categorization_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  pattern     VARCHAR(255) NOT NULL, -- substring match or normalized merchant
  priority    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cat_rules_user ON categorization_rules (user_id);
CREATE INDEX idx_cat_rules_category ON categorization_rules (category_id);

-- -----------------------------------------------------------------------------
-- Transactions (income / expense; recurring support)
-- -----------------------------------------------------------------------------
CREATE TYPE recurrence_freq AS ENUM ('none', 'daily', 'weekly', 'monthly', 'yearly');

CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories (id) ON DELETE SET NULL,
  type            VARCHAR(16) NOT NULL CHECK (type IN ('income', 'expense')),
  amount          NUMERIC(18, 2) NOT NULL CHECK (amount >= 0),
  description     TEXT,
  notes           TEXT,
  occurred_at     DATE NOT NULL DEFAULT (CURRENT_DATE),
  recurrence      recurrence_freq NOT NULL DEFAULT 'none',
  recurrence_end  DATE,
  parent_series_id UUID, -- optional: link generated instances to a template row
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tx_user_date ON transactions (user_id, occurred_at DESC);
CREATE INDEX idx_tx_user_account ON transactions (user_id, account_id);
CREATE INDEX idx_tx_user_category ON transactions (user_id, category_id);
CREATE INDEX idx_tx_type ON transactions (user_id, type, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- Budgets (monthly per category)
-- -----------------------------------------------------------------------------
CREATE TABLE budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  year         INT NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month        INT NOT NULL CHECK (month >= 1 AND month <= 12),
  amount_limit NUMERIC(18, 2) NOT NULL CHECK (amount_limit >= 0),
  alert_threshold_percent INT DEFAULT 80 CHECK (alert_threshold_percent BETWEEN 0 AND 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id, year, month)
);

CREATE INDEX idx_budgets_user_period ON budgets (user_id, year, month);

-- -----------------------------------------------------------------------------
-- Savings goals
-- -----------------------------------------------------------------------------
CREATE TABLE savings_goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  account_id   UUID REFERENCES accounts (id) ON DELETE SET NULL,
  name         VARCHAR(120) NOT NULL,
  target_amount NUMERIC(18, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goals_user ON savings_goals (user_id);

-- -----------------------------------------------------------------------------
-- Notifications (budget alerts, monthly summary flags)
-- -----------------------------------------------------------------------------
CREATE TYPE notification_type AS ENUM ('budget_warning', 'budget_exceeded', 'monthly_summary', 'system');

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT,
  read_at    TIMESTAMPTZ,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- Optional: persisted AI / rule-based insight snapshots (cache)
-- -----------------------------------------------------------------------------
CREATE TABLE insight_snapshots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insights_user_period ON insight_snapshots (user_id, period_start, period_end);

-- -----------------------------------------------------------------------------
-- Triggers: updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER accounts_updated BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER transactions_updated BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER budgets_updated BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
CREATE TRIGGER savings_goals_updated BEFORE UPDATE ON savings_goals
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
