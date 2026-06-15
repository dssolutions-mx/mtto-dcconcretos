-- Unify checklist core item normalization (ESCALERA vs ESCALERA EN BUEN ESTADO, etc.)

CREATE OR REPLACE FUNCTION public.normalize_issue_core_item(p_description text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text text;
  v_pos int;
BEGIN
  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RETURN '';
  END IF;

  v_text := btrim(p_description);
  v_pos := position(' - ' in v_text);
  IF v_pos > 0 THEN
    v_text := btrim(substring(v_text from 1 for v_pos - 1));
  END IF;

  v_text := regexp_replace(v_text, '\s+', ' ', 'g');
  v_text := upper(btrim(v_text));

  -- Strip checklist template suffixes so variants share one canonical key.
  v_text := regexp_replace(v_text, '\s+EN\s+BUEN\s+ESTADO$', '', 'i');
  v_text := regexp_replace(v_text, '\s+FUNCIONANDO$', '', 'i');
  v_text := regexp_replace(v_text, '\s+FUNCIONAN$', '', 'i');
  v_text := btrim(v_text);

  RETURN v_text;
END;
$$;

UPDATE public.incident_history ih
SET canonical_issue_key = public.generate_canonical_issue_key(ih.asset_id, ih.description)
WHERE ih.asset_id IS NOT NULL;

UPDATE public.checklist_issues ci
SET canonical_issue_key = public.generate_canonical_issue_key(cc.asset_id, ci.description)
FROM public.completed_checklists cc
WHERE cc.id = ci.checklist_id;

UPDATE public.checklist_issues
SET issue_fingerprint = canonical_issue_key
WHERE canonical_issue_key IS NOT NULL
  AND (issue_fingerprint IS NULL OR issue_fingerprint <> canonical_issue_key);
