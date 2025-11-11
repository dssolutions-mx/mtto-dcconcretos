-- Allow negative amounts in manual_financial_adjustments
-- This is needed for refunds, devolutions, and credits

-- Remove the check constraint that requires amount >= 0
ALTER TABLE manual_financial_adjustments
DROP CONSTRAINT IF EXISTS manual_financial_adjustments_amount_check;

-- Also update the distribution table to allow negative amounts
ALTER TABLE manual_financial_adjustment_distributions
DROP CONSTRAINT IF EXISTS manual_financial_adjustment_distributions_amount_check;

-- Add comment explaining negative amounts are allowed
COMMENT ON COLUMN manual_financial_adjustments.amount IS 'Amount can be positive (expense) or negative (refund/credit/devolution)';

