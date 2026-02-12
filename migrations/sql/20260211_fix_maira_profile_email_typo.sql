-- =====================================================
-- Migration: 20260211_fix_maira_profile_email_typo
-- Decision: D006 - Fix MAIRA profiles.email typo to match auth
-- Purpose: Unblock GM approvals when MAIRA clicks from email
-- =====================================================

-- Fix typo: mantenimientotj -> mantenimientotij (matches auth.users.email)
-- Decision D006 - Unblocks GM approvals when MAIRA clicks from email
UPDATE profiles
SET email = 'mantenimientotij@dcconcretos.com.mx',
    updated_at = NOW()
WHERE id = '6c549cf9-dc2e-4012-9f8f-d45688cd485b'
  AND email = 'mantenimientotj@dcconcretos.com.mx';
