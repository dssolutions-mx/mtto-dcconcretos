-- Backfill last 14 days: copy checklist_evidence URLs onto checklist_issues (when empty),
-- and append the same evidence into incident_history.documents and work_orders.creation_photos.
-- Duplicates are allowed (same URL may appear on issue row and in incident/WO "buckets").

DO $$
DECLARE
  r RECORD;
  ev RECORD;
  v_template_id uuid;
  v_item_section uuid;
  v_has_evidence_sections boolean;
  v_use_all_evidence boolean;
  v_docs jsonb;
  v_photos jsonb;
  v_ts text;
  v_first_url text;
BEGIN
  v_ts := to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

  FOR r IN
    SELECT
      ci.id AS issue_id,
      ci.checklist_id AS completed_id,
      ci.item_id,
      ci.incident_id,
      ci.work_order_id,
      ci.photo_url AS issue_photo
    FROM checklist_issues ci
    WHERE ci.created_at >= (now() - interval '14 days')
  LOOP
    SELECT cc.checklist_id
    INTO v_template_id
    FROM completed_checklists cc
    WHERE cc.id = r.completed_id;

    IF v_template_id IS NULL THEN
      CONTINUE;
    END IF;

    v_item_section := NULL;
    BEGIN
      SELECT ci2.section_id
      INTO v_item_section
      FROM checklist_items ci2
      WHERE ci2.id = r.item_id::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_item_section := NULL;
    END;

    SELECT EXISTS (
      SELECT 1
      FROM checklist_sections cs
      WHERE cs.checklist_id = v_template_id
        AND cs.section_type = 'evidence'
    )
    INTO v_has_evidence_sections;

    v_use_all_evidence := (v_item_section IS NULL AND NOT COALESCE(v_has_evidence_sections, false));

    -- Import first matching evidence URL onto checklist_issues.photo_url when empty (second "bucket" vs evidence table)
    IF r.issue_photo IS NULL OR btrim(r.issue_photo) = '' THEN
      v_first_url := NULL;
      IF v_use_all_evidence THEN
        SELECT btrim(ce.photo_url)
        INTO v_first_url
        FROM checklist_evidence ce
        WHERE ce.completed_checklist_id = r.completed_id
          AND ce.photo_url IS NOT NULL
          AND btrim(ce.photo_url) <> ''
        ORDER BY ce.sequence_order NULLS LAST, ce.created_at NULLS LAST
        LIMIT 1;
      ELSE
        SELECT btrim(ce.photo_url)
        INTO v_first_url
        FROM checklist_evidence ce
        WHERE ce.completed_checklist_id = r.completed_id
          AND ce.photo_url IS NOT NULL
          AND btrim(ce.photo_url) <> ''
          AND (
            (v_item_section IS NOT NULL AND ce.section_id = v_item_section)
            OR ce.section_id IN (
              SELECT cs.id
              FROM checklist_sections cs
              WHERE cs.checklist_id = v_template_id
                AND cs.section_type = 'evidence'
            )
          )
        ORDER BY ce.sequence_order NULLS LAST, ce.created_at NULLS LAST
        LIMIT 1;
      END IF;

      IF v_first_url IS NOT NULL AND v_first_url <> '' THEN
        UPDATE checklist_issues
        SET photo_url = v_first_url
        WHERE id = r.issue_id;
      END IF;
    END IF;

    -- Append all matching evidence URLs to incident (allow duplicate strings vs existing array)
    IF r.incident_id IS NOT NULL THEN
      SELECT COALESCE(documents, '[]'::jsonb)
      INTO v_docs
      FROM incident_history
      WHERE id = r.incident_id;

      IF v_use_all_evidence THEN
        FOR ev IN
          SELECT ce.photo_url, ce.description, ce.category
          FROM checklist_evidence ce
          WHERE ce.completed_checklist_id = r.completed_id
            AND ce.photo_url IS NOT NULL
            AND btrim(ce.photo_url) <> ''
          ORDER BY ce.sequence_order NULLS LAST, ce.created_at NULLS LAST
        LOOP
          v_docs := v_docs || jsonb_build_array(btrim(ev.photo_url));
        END LOOP;
      ELSE
        FOR ev IN
          SELECT ce.photo_url, ce.description, ce.category
          FROM checklist_evidence ce
          WHERE ce.completed_checklist_id = r.completed_id
            AND ce.photo_url IS NOT NULL
            AND btrim(ce.photo_url) <> ''
            AND (
              (v_item_section IS NOT NULL AND ce.section_id = v_item_section)
              OR ce.section_id IN (
                SELECT cs.id
                FROM checklist_sections cs
                WHERE cs.checklist_id = v_template_id
                  AND cs.section_type = 'evidence'
              )
            )
          ORDER BY ce.sequence_order NULLS LAST, ce.created_at NULLS LAST
        LOOP
          v_docs := v_docs || jsonb_build_array(btrim(ev.photo_url));
        END LOOP;
      END IF;

      UPDATE incident_history
      SET documents = CASE
        WHEN jsonb_array_length(v_docs) > 0 THEN v_docs
        ELSE documents
      END
      WHERE id = r.incident_id;
    END IF;

    -- Append rich rows to work_orders.creation_photos (duplicates allowed)
    IF r.work_order_id IS NOT NULL THEN
      SELECT COALESCE(creation_photos, '[]'::jsonb)
      INTO v_photos
      FROM work_orders
      WHERE id = r.work_order_id;

      IF v_use_all_evidence THEN
        FOR ev IN
          SELECT ce.photo_url, ce.description, ce.category
          FROM checklist_evidence ce
          WHERE ce.completed_checklist_id = r.completed_id
            AND ce.photo_url IS NOT NULL
            AND btrim(ce.photo_url) <> ''
          ORDER BY ce.sequence_order NULLS LAST, ce.created_at NULLS LAST
        LOOP
          v_photos := v_photos || jsonb_build_array(
            jsonb_build_object(
              'url', btrim(ev.photo_url),
              'description', COALESCE(ev.description, ''),
              'category', COALESCE(NULLIF(btrim(ev.category), ''), 'checklist_evidence'),
              'uploaded_at', v_ts
            )
          );
        END LOOP;
      ELSE
        FOR ev IN
          SELECT ce.photo_url, ce.description, ce.category
          FROM checklist_evidence ce
          WHERE ce.completed_checklist_id = r.completed_id
            AND ce.photo_url IS NOT NULL
            AND btrim(ce.photo_url) <> ''
            AND (
              (v_item_section IS NOT NULL AND ce.section_id = v_item_section)
              OR ce.section_id IN (
                SELECT cs.id
                FROM checklist_sections cs
                WHERE cs.checklist_id = v_template_id
                  AND cs.section_type = 'evidence'
              )
            )
          ORDER BY ce.sequence_order NULLS LAST, ce.created_at NULLS LAST
        LOOP
          v_photos := v_photos || jsonb_build_array(
            jsonb_build_object(
              'url', btrim(ev.photo_url),
              'description', COALESCE(ev.description, ''),
              'category', COALESCE(NULLIF(btrim(ev.category), ''), 'checklist_evidence'),
              'uploaded_at', v_ts
            )
          );
        END LOOP;
      END IF;

      UPDATE work_orders
      SET creation_photos = CASE
        WHEN jsonb_array_length(v_photos) > 0 THEN v_photos
        ELSE creation_photos
      END
      WHERE id = r.work_order_id;
    END IF;
  END LOOP;
END;
$$;
