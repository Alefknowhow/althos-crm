-- Migration: 0022_sales.sql
-- Description: Registry of sold products/services. Minimal v1, designed to
-- grow into appointment-based vertical workflows (clinics, real estate, auto).

CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    seller_id UUID, -- references auth.users(id); not enforced to avoid cross-schema FK issues
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity INTEGER NOT NULL DEFAULT 1,
    amount_cents INTEGER NOT NULL DEFAULT 0, -- final total practiced (cents)
    payment_method TEXT, -- 'pix', 'boleto', 'credito', 'debito', 'dinheiro', 'transferencia', custom
    installments INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_organization_id ON sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_org_date ON sales(organization_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_lead ON sales(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_id);

DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON sales
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sales access" ON sales;
CREATE POLICY "Sales access" ON sales
FOR ALL USING (organization_id IN (SELECT get_user_organizations()));
