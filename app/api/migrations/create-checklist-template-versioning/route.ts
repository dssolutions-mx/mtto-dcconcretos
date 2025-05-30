import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const migrationSQL = `
      -- Migration: create-checklist-template-versioning
      -- This migration creates the versioning infrastructure for checklist templates
      
      -- Nueva tabla para versiones de plantillas
      CREATE TABLE IF NOT EXISTS checklist_template_versions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        template_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        model_id UUID REFERENCES equipment_models(id),
        frequency TEXT,
        hours_interval INTEGER,
        sections JSONB NOT NULL, -- Snapshot completo de secciones e ítems
        is_active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id),
        change_summary TEXT, -- Resumen de cambios
        migration_notes TEXT, -- Notas para migración
        
        UNIQUE(template_id, version_number)
      );
      
      -- Agregar columna para rastrear qué versión se usó en cada ejecución
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'completed_checklists' 
          AND column_name = 'template_version_id'
        ) THEN
          ALTER TABLE completed_checklists 
          ADD COLUMN template_version_id UUID REFERENCES checklist_template_versions(id);
        END IF;
      END $$;
      
      -- Índices para performance
      CREATE INDEX IF NOT EXISTS idx_template_versions_template_id 
        ON checklist_template_versions(template_id);
      CREATE INDEX IF NOT EXISTS idx_template_versions_active 
        ON checklist_template_versions(template_id, is_active) WHERE is_active = true;
      CREATE INDEX IF NOT EXISTS idx_completed_checklists_template_version 
        ON completed_checklists(template_version_id);
      
      -- Función para crear nueva versión de plantilla
      CREATE OR REPLACE FUNCTION create_template_version(
        p_template_id UUID,
        p_change_summary TEXT DEFAULT 'Cambios en plantilla',
        p_migration_notes TEXT DEFAULT NULL
      ) RETURNS UUID AS $$
      DECLARE
        v_version_id UUID;
        v_next_version INTEGER;
        v_template RECORD;
        v_sections JSONB;
      BEGIN
        -- Obtener siguiente número de versión
        SELECT COALESCE(MAX(version_number), 0) + 1 
        INTO v_next_version 
        FROM checklist_template_versions 
        WHERE template_id = p_template_id;
        
        -- Obtener datos actuales de la plantilla
        SELECT * INTO v_template FROM checklists WHERE id = p_template_id;
        
        IF v_template.id IS NULL THEN
          RAISE EXCEPTION 'Template with id % not found', p_template_id;
        END IF;
        
        -- Crear snapshot de secciones e ítems
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'order_index', s.order_index,
            'items', (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', i.id,
                  'description', i.description,
                  'required', i.required,
                  'order_index', i.order_index,
                  'item_type', i.item_type,
                  'expected_value', i.expected_value,
                  'tolerance', i.tolerance
                ) ORDER BY i.order_index
              )
              FROM checklist_items i 
              WHERE i.section_id = s.id
            )
          ) ORDER BY s.order_index
        ) INTO v_sections
        FROM checklist_sections s 
        WHERE s.checklist_id = p_template_id;
        
        -- Si no hay secciones, crear un JSONB vacío
        IF v_sections IS NULL THEN
          v_sections := '[]'::jsonb;
        END IF;
        
        -- Desactivar versión anterior
        UPDATE checklist_template_versions 
        SET is_active = FALSE 
        WHERE template_id = p_template_id;
        
        -- Crear nueva versión
        INSERT INTO checklist_template_versions (
          template_id,
          version_number,
          name,
          description,
          model_id,
          frequency,
          hours_interval,
          sections,
          is_active,
          change_summary,
          migration_notes,
          created_by
        ) VALUES (
          p_template_id,
          v_next_version,
          v_template.name,
          v_template.description,
          v_template.model_id,
          v_template.frequency,
          v_template.hours_interval,
          v_sections,
          TRUE,
          p_change_summary,
          p_migration_notes,
          auth.uid()
        ) RETURNING id INTO v_version_id;
        
        RETURN v_version_id;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      
      -- Función para restaurar versión específica
      CREATE OR REPLACE FUNCTION restore_template_version(
        p_version_id UUID
      ) RETURNS BOOLEAN AS $$
      DECLARE
        v_version RECORD;
        v_section JSONB;
        v_item JSONB;
        v_section_id UUID;
      BEGIN
        -- Obtener datos de la versión
        SELECT * INTO v_version FROM checklist_template_versions WHERE id = p_version_id;
        
        IF v_version.id IS NULL THEN
          RAISE EXCEPTION 'Version with id % not found', p_version_id;
        END IF;
        
        -- Actualizar plantilla principal
        UPDATE checklists SET
          name = v_version.name,
          description = v_version.description,
          model_id = v_version.model_id,
          frequency = v_version.frequency,
          hours_interval = v_version.hours_interval,
          updated_at = NOW(),
          updated_by = auth.uid()
        WHERE id = v_version.template_id;
        
        -- Eliminar secciones e ítems actuales
        DELETE FROM checklist_items WHERE section_id IN (
          SELECT id FROM checklist_sections WHERE checklist_id = v_version.template_id
        );
        DELETE FROM checklist_sections WHERE checklist_id = v_version.template_id;
        
        -- Recrear secciones e ítems desde la versión
        FOR v_section IN SELECT jsonb_array_elements(v_version.sections)
        LOOP
          INSERT INTO checklist_sections (
            checklist_id, title, order_index, created_by
          ) VALUES (
            v_version.template_id,
            v_section->>'title',
            (v_section->>'order_index')::INTEGER,
            auth.uid()
          ) RETURNING id INTO v_section_id;
          
          FOR v_item IN SELECT jsonb_array_elements(v_section->'items')
          LOOP
            INSERT INTO checklist_items (
              section_id,
              description,
              required,
              order_index,
              item_type,
              expected_value,
              tolerance,
              created_by
            ) VALUES (
              v_section_id,
              v_item->>'description',
              COALESCE((v_item->>'required')::BOOLEAN, TRUE),
              (v_item->>'order_index')::INTEGER,
              COALESCE(v_item->>'item_type', 'check'),
              v_item->>'expected_value',
              v_item->>'tolerance',
              auth.uid()
            );
          END LOOP;
        END LOOP;
        
        -- Marcar esta versión como activa
        UPDATE checklist_template_versions 
        SET is_active = FALSE 
        WHERE template_id = v_version.template_id;
        
        UPDATE checklist_template_versions 
        SET is_active = TRUE 
        WHERE id = p_version_id;
        
        RETURN TRUE;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      
      -- Función para obtener la versión activa de una plantilla
      CREATE OR REPLACE FUNCTION get_active_template_version(p_template_id UUID)
      RETURNS UUID AS $$
      DECLARE
        v_version_id UUID;
      BEGIN
        SELECT id INTO v_version_id
        FROM checklist_template_versions
        WHERE template_id = p_template_id AND is_active = TRUE;
        
        RETURN v_version_id;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      
      -- Función actualizada para completar checklist con versionado
      CREATE OR REPLACE FUNCTION mark_checklist_as_completed_versioned(
        p_schedule_id UUID,
        p_completed_items JSONB,
        p_technician TEXT,
        p_notes TEXT DEFAULT NULL,
        p_signature_data TEXT DEFAULT NULL
      ) RETURNS JSONB AS $$
      DECLARE
        v_checklist_id UUID;
        v_asset_id UUID;
        v_template_version_id UUID;
        v_status TEXT := 'Completado';
        v_item JSONB;
        v_completed_id UUID;
        v_has_issues BOOLEAN := FALSE;
      BEGIN
        -- Obtener información de la programación
        SELECT template_id, asset_id 
        INTO v_checklist_id, v_asset_id
        FROM checklist_schedules
        WHERE id = p_schedule_id;
        
        IF v_checklist_id IS NULL THEN
          RAISE EXCEPTION 'Schedule with id % not found', p_schedule_id;
        END IF;
        
        -- Obtener versión activa de la plantilla
        SELECT id INTO v_template_version_id
        FROM checklist_template_versions
        WHERE template_id = v_checklist_id AND is_active = TRUE;
        
        -- Si no hay versión activa, crear una
        IF v_template_version_id IS NULL THEN
          SELECT create_template_version(v_checklist_id, 'Versión inicial - creada automáticamente') 
          INTO v_template_version_id;
        END IF;
        
        -- Verificar si hay problemas
        FOR v_item IN SELECT jsonb_array_elements(p_completed_items)
        LOOP
          IF v_item->>'status' = 'flag' OR v_item->>'status' = 'fail' THEN
            v_has_issues := TRUE;
            v_status := 'Con Problemas';
          END IF;
        END LOOP;
        
        -- Registrar el checklist completado con referencia a versión
        INSERT INTO completed_checklists (
          checklist_id,
          template_version_id,
          asset_id,
          completed_items,
          technician,
          completion_date,
          notes,
          status,
          signature_data
        ) VALUES (
          v_checklist_id,
          v_template_version_id,
          v_asset_id,
          p_completed_items,
          p_technician,
          NOW(),
          p_notes,
          v_status,
          p_signature_data
        ) RETURNING id INTO v_completed_id;
        
        -- Actualizar estado de la programación
        UPDATE checklist_schedules
        SET status = 'completado'
        WHERE id = p_schedule_id;
        
        -- Si hay problemas, registrarlos
        IF v_has_issues THEN
          FOR v_item IN SELECT jsonb_array_elements(p_completed_items)
          LOOP
            IF v_item->>'status' = 'flag' OR v_item->>'status' = 'fail' THEN
              INSERT INTO checklist_issues (
                checklist_id,
                item_id,
                status,
                description,
                notes,
                photo_url,
                resolved
              ) VALUES (
                v_completed_id,
                v_item->>'item_id',
                v_item->>'status',
                COALESCE(v_item->>'description', 'Problema detectado durante el checklist'),
                v_item->>'notes',
                v_item->>'photo_url',
                FALSE
              );
            END IF;
          END LOOP;
        END IF;
        
        -- Actualizar fecha de último mantenimiento del activo
        UPDATE assets
        SET last_maintenance_date = NOW()
        WHERE id = v_asset_id;
        
        RETURN jsonb_build_object(
          'success', TRUE,
          'completed_id', v_completed_id,
          'template_version_id', v_template_version_id,
          'has_issues', v_has_issues
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      
      -- Crear versiones iniciales para plantillas existentes
      DO $$
      DECLARE
        v_template RECORD;
        v_version_id UUID;
      BEGIN
        -- Para cada plantilla existente, crear versión inicial si no existe
        FOR v_template IN SELECT * FROM checklists
        LOOP
          -- Verificar si ya tiene versiones
          IF NOT EXISTS (
            SELECT 1 FROM checklist_template_versions 
            WHERE template_id = v_template.id
          ) THEN
            SELECT create_template_version(
              v_template.id,
              'Versión inicial - migración automática',
              'Creada durante migración del sistema de versionado'
            ) INTO v_version_id;
            
            -- Asociar checklists completados existentes con esta versión
            UPDATE completed_checklists 
            SET template_version_id = v_version_id
            WHERE checklist_id = v_template.id
              AND template_version_id IS NULL;
          END IF;
        END LOOP;
      END;
      $$;
      
      -- RLS para checklist_template_versions
      ALTER TABLE checklist_template_versions ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "Users can view template versions" ON checklist_template_versions
        FOR SELECT USING (true);
      
      CREATE POLICY "Users can insert template versions" ON checklist_template_versions
        FOR INSERT WITH CHECK (auth.uid() = created_by);
      
      CREATE POLICY "Users can update their template versions" ON checklist_template_versions
        FOR UPDATE USING (auth.uid() = created_by);
    `
    
    // Use a mock response for now since we'll run this directly via Supabase
    console.log('Checklist template versioning migration SQL generated')
    
    return NextResponse.json({
      success: true,
      message: 'Checklist template versioning migration ready',
      sql: migrationSQL
    })
    
  } catch (error) {
    console.error('Error in migration:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 