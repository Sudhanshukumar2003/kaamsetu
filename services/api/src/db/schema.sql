-- KaamSetu V1 Database Schema
-- Run: psql -U postgres -d kaamsetu -f schema.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy text search

-- ─────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('worker', 'hirer', 'admin', 'field_agent');
CREATE TYPE kyc_status AS ENUM ('pending', 'submitted', 'verified', 'rejected', 'expired');
CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'expert', 'master');
CREATE TYPE gig_status AS ENUM (
  'draft', 'open', 'matched', 'accepted',
  'in_progress', 'completed', 'disputed', 'cancelled'
);
CREATE TYPE payment_status AS ENUM (
  'pending', 'escrow_held', 'escrow_released',
  'refunded', 'disputed', 'failed'
);
CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved_worker', 'resolved_hirer', 'closed');
CREATE TYPE notification_channel AS ENUM ('push', 'whatsapp', 'sms', 'email');
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'delivered', 'failed');

-- ─────────────────────────────────────────────
-- TRADES (reference data)
-- ─────────────────────────────────────────────

CREATE TABLE trades (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          VARCHAR(60) UNIQUE NOT NULL,  -- 'electrician', 'plumber'
  name_en       VARCHAR(100) NOT NULL,
  name_hi       VARCHAR(100),                 -- Hindi translation
  category      VARCHAR(60),                  -- 'construction', 'domestic', 'industrial'
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- USERS (base table — both workers and hirers)
-- ─────────────────────────────────────────────

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone             VARCHAR(15) UNIQUE NOT NULL,
  phone_verified    BOOLEAN DEFAULT false,
  email             VARCHAR(255) UNIQUE,
  email_verified    BOOLEAN DEFAULT false,
  full_name         VARCHAR(200),
  role              user_role NOT NULL,
  profile_photo_url TEXT,
  preferred_lang    VARCHAR(10) DEFAULT 'hi',  -- 'hi', 'en', 'mr', 'ta'
  fcm_token         TEXT,                       -- for push notifications
  whatsapp_optin    BOOLEAN DEFAULT true,
  is_active         BOOLEAN DEFAULT true,
  is_suspended      BOOLEAN DEFAULT false,
  suspension_reason TEXT,
  last_seen_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role  ON users(role);

-- ─────────────────────────────────────────────
-- OTP STORE (for phone verification)
-- ─────────────────────────────────────────────

CREATE TABLE otp_codes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone       VARCHAR(15) NOT NULL,
  code        VARCHAR(6) NOT NULL,
  purpose     VARCHAR(30) NOT NULL,   -- 'login', 'registration', 'aadhaar'
  attempts    INTEGER DEFAULT 0,
  is_used     BOOLEAN DEFAULT false,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_phone_purpose ON otp_codes(phone, purpose);

-- ─────────────────────────────────────────────
-- WORKER PROFILES
-- ─────────────────────────────────────────────

CREATE TABLE worker_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id             VARCHAR(20) UNIQUE,        -- KS-2025-XXXXX (issued after KYC)
  trade_id            UUID REFERENCES trades(id),
  skill_level         skill_level DEFAULT 'beginner',
  years_experience    INTEGER DEFAULT 0,
  bio                 TEXT,
  -- Location (PostGIS point: longitude, latitude)
  location            GEOGRAPHY(POINT, 4326),
  city                VARCHAR(100),
  state               VARCHAR(100),
  pincode             VARCHAR(10),
  -- Availability
  is_available        BOOLEAN DEFAULT false,
  available_from      DATE,
  -- KYC
  kyc_status          kyc_status DEFAULT 'pending',
  aadhaar_last4       VARCHAR(4),               -- only last 4 digits stored
  aadhaar_name        VARCHAR(200),             -- name from Aadhaar
  aadhaar_dob         DATE,
  aadhaar_verified_at TIMESTAMPTZ,
  face_match_score    FLOAT,                    -- from IDfy
  -- Reputation
  total_gigs          INTEGER DEFAULT 0,
  total_earnings      BIGINT DEFAULT 0,          -- in paise (₹ × 100)
  avg_rating          FLOAT DEFAULT 0.0,
  rating_count        INTEGER DEFAULT 0,
  -- Onboarding
  onboarded_by        UUID REFERENCES users(id), -- field agent who onboarded
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for geo-matching queries
CREATE INDEX idx_worker_location  ON worker_profiles USING GIST(location);
CREATE INDEX idx_worker_available ON worker_profiles(is_available, trade_id, skill_level);
CREATE INDEX idx_worker_kyc       ON worker_profiles(kyc_status);

-- ─────────────────────────────────────────────
-- WORKER SKILLS (secondary trades)
-- ─────────────────────────────────────────────

CREATE TABLE worker_skills (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id   UUID NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  trade_id    UUID NOT NULL REFERENCES trades(id),
  skill_level skill_level DEFAULT 'beginner',
  is_primary  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, trade_id)
);

-- ─────────────────────────────────────────────
-- HIRER PROFILES
-- ─────────────────────────────────────────────

CREATE TABLE hirer_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name   VARCHAR(200),
  business_type   VARCHAR(60),    -- 'housing_society', 'factory', 'individual', 'smb'
  gstin           VARCHAR(20),
  address_line1   VARCHAR(255),
  city            VARCHAR(100),
  state           VARCHAR(100),
  pincode         VARCHAR(10),
  location        GEOGRAPHY(POINT, 4326),
  -- Reputation
  total_gigs_posted INTEGER DEFAULT 0,
  avg_rating        FLOAT DEFAULT 0.0,
  rating_count      INTEGER DEFAULT 0,
  no_show_count     INTEGER DEFAULT 0,   -- hirers who posted but cancelled
  is_verified       BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hirer_location ON hirer_profiles USING GIST(location);

-- ─────────────────────────────────────────────
-- GIGS (core table)
-- ─────────────────────────────────────────────

CREATE TABLE gigs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hirer_id            UUID NOT NULL REFERENCES hirer_profiles(id),
  worker_id           UUID REFERENCES worker_profiles(id),  -- null until matched
  trade_id            UUID NOT NULL REFERENCES trades(id),
  title               VARCHAR(255) NOT NULL,
  description         TEXT,
  required_skill_level skill_level DEFAULT 'intermediate',
  -- Location
  location            GEOGRAPHY(POINT, 4326) NOT NULL,
  address             TEXT NOT NULL,
  city                VARCHAR(100) NOT NULL,
  -- Schedule
  start_date          DATE NOT NULL,
  start_time          TIME,
  estimated_hours     FLOAT,
  -- Pricing (in paise)
  budget_min          BIGINT NOT NULL,
  budget_max          BIGINT NOT NULL,
  agreed_amount       BIGINT,             -- set when worker accepts
  -- Status
  status              gig_status DEFAULT 'open',
  -- Timestamps for lifecycle
  matched_at          TIMESTAMPTZ,
  accepted_at         TIMESTAMPTZ,
  checkin_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  -- Worker checkin geo verification
  checkin_location    GEOGRAPHY(POINT, 4326),
  checkin_distance_m  INTEGER,            -- distance from gig location at checkin
  -- Media
  completion_photo_url TEXT,
  -- Internal
  is_urgent           BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gigs_hirer  ON gigs(hirer_id);
CREATE INDEX idx_gigs_worker ON gigs(worker_id);
CREATE INDEX idx_gigs_status ON gigs(status);
CREATE INDEX idx_gigs_trade  ON gigs(trade_id, required_skill_level);
CREATE INDEX idx_gigs_location ON gigs USING GIST(location);
CREATE INDEX idx_gigs_start_date ON gigs(start_date);

-- ─────────────────────────────────────────────
-- PAYMENTS
-- ─────────────────────────────────────────────

CREATE TABLE payments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id                UUID UNIQUE NOT NULL REFERENCES gigs(id),
  hirer_id              UUID NOT NULL REFERENCES hirer_profiles(id),
  worker_id             UUID NOT NULL REFERENCES worker_profiles(id),
  -- Amounts (in paise)
  gross_amount          BIGINT NOT NULL,     -- what hirer pays
  platform_fee          BIGINT NOT NULL,     -- 10% of gross
  worker_amount         BIGINT NOT NULL,     -- gross - platform_fee
  -- Razorpay references
  razorpay_order_id     VARCHAR(100) UNIQUE,
  razorpay_payment_id   VARCHAR(100),
  razorpay_payout_id    VARCHAR(100),       -- payout to worker
  -- Status
  status                payment_status DEFAULT 'pending',
  escrow_held_at        TIMESTAMPTZ,
  escrow_released_at    TIMESTAMPTZ,
  payout_initiated_at   TIMESTAMPTZ,
  payout_completed_at   TIMESTAMPTZ,
  -- Worker bank/UPI details (snapshot at time of payment)
  worker_upi_id         VARCHAR(100),
  -- Refund
  refunded_at           TIMESTAMPTZ,
  refund_reason         TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_gig    ON payments(gig_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_worker ON payments(worker_id);

-- ─────────────────────────────────────────────
-- REVIEWS
-- ─────────────────────────────────────────────

CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id          UUID NOT NULL REFERENCES gigs(id),
  reviewer_id     UUID NOT NULL REFERENCES users(id),
  reviewee_id     UUID NOT NULL REFERENCES users(id),
  reviewer_role   user_role NOT NULL,    -- 'hirer' reviewing worker, or vice versa
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  -- Specific dimension ratings
  punctuality     INTEGER CHECK (punctuality BETWEEN 1 AND 5),
  quality         INTEGER CHECK (quality BETWEEN 1 AND 5),
  communication   INTEGER CHECK (communication BETWEEN 1 AND 5),
  is_public       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gig_id, reviewer_id)   -- one review per person per gig
);

CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX idx_reviews_gig      ON reviews(gig_id);

-- ─────────────────────────────────────────────
-- DISPUTES
-- ─────────────────────────────────────────────

CREATE TABLE disputes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id          UUID NOT NULL REFERENCES gigs(id),
  payment_id      UUID REFERENCES payments(id),
  raised_by       UUID NOT NULL REFERENCES users(id),
  against         UUID NOT NULL REFERENCES users(id),
  reason          VARCHAR(100) NOT NULL,
  description     TEXT NOT NULL,
  evidence_urls   TEXT[],                 -- S3 photo/video links
  status          dispute_status DEFAULT 'open',
  assigned_to     UUID REFERENCES users(id),  -- admin
  resolution_note TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel     notification_channel NOT NULL,
  type        VARCHAR(60) NOT NULL,     -- 'gig_matched', 'payment_released', etc.
  title       TEXT,
  body        TEXT NOT NULL,
  data        JSONB,                    -- extra payload (gig_id, etc.)
  status      notification_status DEFAULT 'queued',
  sent_at     TIMESTAMPTZ,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user   ON notifications(user_id, read_at);
CREATE INDEX idx_notifications_status ON notifications(status);

-- ─────────────────────────────────────────────
-- WORKER UPI DETAILS (for payouts)
-- ─────────────────────────────────────────────

CREATE TABLE worker_bank_details (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_id       UUID UNIQUE NOT NULL REFERENCES worker_profiles(id),
  upi_id          VARCHAR(100),
  bank_name       VARCHAR(100),
  account_number  VARCHAR(50),          -- encrypted at app level
  ifsc_code       VARCHAR(20),
  is_verified     BOOLEAN DEFAULT false,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────────

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(60),
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user   ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ─────────────────────────────────────────────
-- UPDATED_AT TRIGGER (auto-update timestamps)
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_worker_profiles_updated_at
  BEFORE UPDATE ON worker_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_hirer_profiles_updated_at
  BEFORE UPDATE ON hirer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_gigs_updated_at
  BEFORE UPDATE ON gigs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- SEED: TRADES
-- ─────────────────────────────────────────────

INSERT INTO trades (slug, name_en, name_hi, category) VALUES
  ('electrician',   'Electrician',    'इलेक्ट्रीशियन',  'construction'),
  ('plumber',       'Plumber',        'प्लम्बर',         'construction'),
  ('carpenter',     'Carpenter',      'बढ़ई',            'construction'),
  ('painter',       'Painter',        'पेंटर',           'construction'),
  ('mason',         'Mason',          'राजमिस्त्री',     'construction'),
  ('welder',        'Welder',         'वेल्डर',          'industrial'),
  ('ac_technician', 'AC Technician',  'एसी तकनीशियन',   'domestic'),
  ('tile_layer',    'Tile Layer',     'टाइल लेयर',       'construction'),
  ('helper',        'Construction Helper', 'हेल्पर',    'construction'),
  ('driver',        'Driver',         'ड्राइवर',         'transport');
