-- Add expense category fields to manual_financial_adjustments table
-- For categorizing "otros indirectos" entries according to the 14 expense categories

-- Add expense_category column (nullable for backward compatibility, but required at application level for otros_indirectos)
ALTER TABLE manual_financial_adjustments
ADD COLUMN IF NOT EXISTS expense_category TEXT;

-- Add expense_subcategory column (optional subcategory within the main expense category)
ALTER TABLE manual_financial_adjustments
ADD COLUMN IF NOT EXISTS expense_subcategory TEXT;

-- Add index on expense_category for filtering and reporting
CREATE INDEX IF NOT EXISTS idx_manual_financial_adjustments_expense_category 
ON manual_financial_adjustments(expense_category);

-- Add composite index for common query patterns (period + category + expense_category)
CREATE INDEX IF NOT EXISTS idx_manual_financial_adjustments_expense_lookup 
ON manual_financial_adjustments(period_month, category, expense_category)
WHERE expense_category IS NOT NULL;

-- Add comments
COMMENT ON COLUMN manual_financial_adjustments.expense_category IS 'Expense category ID (1-14) for otros_indirectos entries. Required when category = otros_indirectos.';
COMMENT ON COLUMN manual_financial_adjustments.expense_subcategory IS 'Optional subcategory within the expense category for otros_indirectos entries.';

