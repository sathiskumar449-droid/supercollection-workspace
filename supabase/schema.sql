-- ==============================================================================
-- SuperCollection Work Desk: Enterprise PostgreSQL / Supabase Database Schema
-- Run this script in your Supabase Project SQL Editor (https://app.supabase.com)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('NEW', 'CONFIRMED', 'PACKING', 'PACKED', 'DISPATCHED', 'COMPLETED', 'RETURN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE courier_status AS ENUM ('PENDING', 'SHIPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sms_status AS ENUM ('SENT', 'PENDING', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_source AS ENUM ('WEBSITE', 'WHATSAPP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'ORDER_STAFF', 'PACKING_STAFF', 'DISPATCH_STAFF');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'ORDER_STAFF',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(32) NOT NULL,
    email VARCHAR(255),
    address TEXT NOT NULL,
    city VARCHAR(128) NOT NULL,
    state VARCHAR(128) NOT NULL,
    pincode VARCHAR(16) NOT NULL,
    total_orders INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile);

-- 4. PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(128) NOT NULL DEFAULT 'Apparel',
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. COURIERS
CREATE TABLE IF NOT EXISTS couriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL,
    code VARCHAR(32) UNIQUE NOT NULL,
    is_st_courier BOOLEAN NOT NULL DEFAULT false,
    tracking_url_template TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(64) UNIQUE NOT NULL,
    external_order_id VARCHAR(128) NOT NULL,
    source order_source NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    status order_status NOT NULL DEFAULT 'NEW',
    payment_status VARCHAR(32) NOT NULL DEFAULT 'PAID',
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    packing_started_at TIMESTAMPTZ,
    packed_at TIMESTAMPTZ,
    dispatched_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    packing_staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_external_order UNIQUE (source, external_order_id)
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- 7. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(64),
    size VARCHAR(32) NOT NULL DEFAULT 'M',
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- 8. DISPATCHES
CREATE TABLE IF NOT EXISTS dispatches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    dispatch_id VARCHAR(64) UNIQUE, -- Unique auto-generated ID: e.g. DSP-260922-001
    courier_id UUID REFERENCES couriers(id) ON DELETE SET NULL,
    courier_partner_id VARCHAR(64), -- 'ST_COURIER', 'PROFESSIONAL', 'DTDC'
    llr_number VARCHAR(64),
    pickup_phone VARCHAR(32), -- Dedicated pickup person phone number (separate from customer mobile)
    courier_status courier_status NOT NULL DEFAULT 'PENDING',
    dispatched_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dispatches_dispatch_id ON dispatches(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_courier_partner ON dispatches(courier_partner_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_llr ON dispatches(llr_number);
CREATE INDEX IF NOT EXISTS idx_dispatches_courier_status ON dispatches(courier_status);

-- 9. SMS LOGS (PING4SMS REAL-TIME TRACKING)
CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    mobile VARCHAR(32) NOT NULL,
    provider VARCHAR(64) NOT NULL DEFAULT 'Ping4SMS',
    provider_message_id VARCHAR(128),
    status sms_status NOT NULL DEFAULT 'PENDING',
    provider_response JSONB,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_order_id ON sms_logs(order_id);

-- 10. PACKING SESSIONS
CREATE TABLE IF NOT EXISTS packing_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    notes TEXT
);

-- 11. ACTIVITY LOGS & AUDIT TRAIL
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    user_name VARCHAR(128) NOT NULL,
    user_role user_role NOT NULL,
    action VARCHAR(128) NOT NULL,
    details TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_order_id ON activity_logs(order_id);

-- 12. INTEGRATIONS CONFIGURATION
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(64) UNIQUE NOT NULL, -- 'ping4sms', 'woocommerce', 'whatsapp'
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEED DATA
-- ==============================================================================

-- Couriers
INSERT INTO couriers (name, code, is_st_courier, tracking_url_template, is_active)
VALUES 
    ('ST Courier', 'ST_COURIER', true, 'https://stcourier.com/track?llr={llr}', true),
    ('Delhivery', 'DELHIVERY', false, 'https://www.delhivery.com/track/package/{llr}', true),
    ('DTDC', 'DTDC', false, 'https://www.dtdc.in/tracking/tracking_results.asp?trkid={llr}', true),
    ('Blue Dart', 'BLUE_DART', false, 'https://www.bluedart.com/tracking?handler=t&awb=awb&numbers={llr}', true),
    ('Professional Couriers', 'TPC', false, 'https://www.tpcindia.com/track.aspx?doc_no={llr}', true)
ON CONFLICT (code) DO NOTHING;

-- Initial Staff & Admin Users
INSERT INTO users (email, full_name, role, avatar_url, is_active)
VALUES
    ('admin@supercollection.in', 'Super Admin', 'ADMIN', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128', true),
    ('manager@supercollection.in', 'Karthik Manager', 'MANAGER', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128', true),
    ('packing@supercollection.in', 'Ramesh Packing', 'PACKING_STAFF', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=128', true),
    ('dispatch@supercollection.in', 'Suresh Dispatch', 'DISPATCH_STAFF', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128', true)
ON CONFLICT (email) DO NOTHING;

-- ==============================================================================
-- REAL-TIME SUBSCRIPTIONS
-- Enable Supabase Realtime for instant multi-user synchronization
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatches;
ALTER PUBLICATION supabase_realtime ADD TABLE sms_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon & authenticated read/write for Work Desk internal operations
CREATE POLICY "Public Read Access" ON orders FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON orders FOR UPDATE USING (true);

CREATE POLICY "Public Read Access" ON customers FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON customers FOR UPDATE USING (true);

CREATE POLICY "Public Read Access" ON dispatches FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON dispatches FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON dispatches FOR UPDATE USING (true);

CREATE POLICY "Public Read Access" ON order_items FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON order_items FOR UPDATE USING (true);
CREATE POLICY "Public Delete Access" ON order_items FOR DELETE USING (true);

CREATE POLICY "Public Delete Access" ON orders FOR DELETE USING (true);
CREATE POLICY "Public Delete Access" ON dispatches FOR DELETE USING (true);

CREATE POLICY "Public Read Access" ON sms_logs FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON sms_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON sms_logs FOR UPDATE USING (true);
CREATE POLICY "Public Delete Access" ON sms_logs FOR DELETE USING (true);

CREATE POLICY "Public Read Access" ON couriers FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON users FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON activity_logs FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON activity_logs FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- 13. RETURN MANAGEMENT MODULE (Enterprise Normalized Relational Schema)
-- ==============================================================================

-- 13.1 RETURNS CORE TABLE
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id VARCHAR(64) UNIQUE NOT NULL, -- e.g. RTN-260923-001
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_number VARCHAR(64) NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(32) NOT NULL,
    return_type VARCHAR(32) NOT NULL DEFAULT 'Refund', -- 'Refund', 'Replacement', 'Exchange'
    reason VARCHAR(128) NOT NULL,
    customer_note TEXT,
    status VARCHAR(64) NOT NULL DEFAULT 'Return Requested',
    requested_quantity INTEGER NOT NULL DEFAULT 1,
    received_quantity INTEGER DEFAULT 0,
    approved_quantity INTEGER DEFAULT 0,
    expected_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    refund_amount NUMERIC(10, 2) DEFAULT 0,
    discount_adjustment NUMERIC(10, 2) DEFAULT 0,
    shipping_adjustment NUMERIC(10, 2) DEFAULT 0,
    received_at TIMESTAMPTZ,
    received_by VARCHAR(128),
    receiving_note TEXT,
    created_by VARCHAR(128) NOT NULL DEFAULT 'Admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_return_id ON returns(return_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON returns(created_at);

-- 13.2 RETURN ITEMS TABLE
CREATE TABLE IF NOT EXISTS return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(64),
    color VARCHAR(64),
    size VARCHAR(32),
    purchased_quantity INTEGER NOT NULL DEFAULT 1,
    requested_quantity INTEGER NOT NULL DEFAULT 1,
    received_quantity INTEGER DEFAULT 0,
    approved_quantity INTEGER DEFAULT 0,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    return_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);

-- 13.3 RETURN QC INSPECTION TABLE
CREATE TABLE IF NOT EXISTS return_qc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID UNIQUE NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    condition VARCHAR(64) NOT NULL DEFAULT 'Good', -- 'Good', 'Used', 'Damaged', 'Missing Item', 'Wrong Item'
    qc_result VARCHAR(64) NOT NULL DEFAULT 'Approved', -- 'Approved', 'Partially Approved', 'Rejected'
    inventory_disposition VARCHAR(64) NOT NULL DEFAULT 'Restock', -- 'Restock', 'Damaged Stock', 'Hold', 'Other'
    qc_notes TEXT,
    checked_by VARCHAR(128) NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_return_qc_return_id ON return_qc(return_id);

-- 13.4 RETURN REFUNDS TABLE
CREATE TABLE IF NOT EXISTS return_refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID UNIQUE NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    refund_status VARCHAR(32) NOT NULL DEFAULT 'Pending', -- 'Not Started', 'Pending', 'Processing', 'Refunded', 'Failed'
    refund_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    refund_method VARCHAR(64), -- 'UPI', 'Bank Transfer', 'Cash', 'Original Payment Method', 'Other'
    utr_reference VARCHAR(128),
    refund_notes TEXT,
    processed_by VARCHAR(128),
    refund_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_return_refunds_return_id ON return_refunds(return_id);
CREATE INDEX IF NOT EXISTS idx_return_refunds_status ON return_refunds(refund_status);

-- 13.5 RETURN REPLACEMENTS TABLE
CREATE TABLE IF NOT EXISTS return_replacements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID UNIQUE NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    replacement_id VARCHAR(64) UNIQUE NOT NULL, -- e.g. REP-260923-001
    original_order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    original_order_number VARCHAR(64) NOT NULL,
    original_item_name VARCHAR(255) NOT NULL,
    returned_item VARCHAR(255) NOT NULL,
    replacement_item VARCHAR(255) NOT NULL,
    color VARCHAR(64),
    size VARCHAR(32) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(64) NOT NULL DEFAULT 'Waiting for Packing', -- 'Waiting for Packing', 'Packing', 'Packed', 'Dispatched', 'Delivered'
    dispatch_id VARCHAR(64), -- Auto-generated e.g. DSP-260923-021
    courier VARCHAR(128),
    llr VARCHAR(64),
    tracking TEXT,
    dispatched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_return_replacements_return_id ON return_replacements(return_id);
CREATE INDEX IF NOT EXISTS idx_return_replacements_rep_id ON return_replacements(replacement_id);

-- 13.6 RETURN TIMELINE AUDIT TABLE
CREATE TABLE IF NOT EXISTS return_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    action VARCHAR(128) NOT NULL,
    user_name VARCHAR(128) NOT NULL,
    user_role VARCHAR(64) NOT NULL DEFAULT 'ADMIN',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_return_timeline_return_id ON return_timeline(return_id);

-- Enable RLS for Returns Tables
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_qc ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_replacements ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access" ON returns FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON returns FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON returns FOR UPDATE USING (true);
CREATE POLICY "Public Delete Access" ON returns FOR DELETE USING (true);

CREATE POLICY "Public Read Access" ON return_items FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON return_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON return_items FOR UPDATE USING (true);
CREATE POLICY "Public Delete Access" ON return_items FOR DELETE USING (true);

CREATE POLICY "Public Read Access" ON return_qc FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON return_qc FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON return_qc FOR UPDATE USING (true);

CREATE POLICY "Public Read Access" ON return_refunds FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON return_refunds FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON return_refunds FOR UPDATE USING (true);

CREATE POLICY "Public Read Access" ON return_replacements FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON return_replacements FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Access" ON return_replacements FOR UPDATE USING (true);

CREATE POLICY "Public Read Access" ON return_timeline FOR SELECT USING (true);
CREATE POLICY "Public Insert Access" ON return_timeline FOR INSERT WITH CHECK (true);

-- Realtime publication for returns
ALTER PUBLICATION supabase_realtime ADD TABLE returns;
ALTER PUBLICATION supabase_realtime ADD TABLE return_refunds;
ALTER PUBLICATION supabase_realtime ADD TABLE return_replacements;
