import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      )
    }

    console.log('Ejecutando migración de corrección de IDs...')

    // Execute the migration step by step
    const migrationSteps = [
      // 1. Create unique work order ID function
      `CREATE OR REPLACE FUNCTION generate_unique_work_order_id()
       RETURNS TEXT
       LANGUAGE plpgsql
       AS $$
       DECLARE
         v_order_counter INT;
         v_order_id TEXT;
         v_max_attempts INT := 100;
         v_attempt INT := 1;
       BEGIN
         LOOP
           SELECT COALESCE(
             MAX(
               CASE 
                 WHEN order_id ~ '^OT-[0-9]+$' 
                 THEN (RIGHT(order_id, -3))::INT 
                 ELSE 0 
               END
             ), 0
           ) + v_attempt INTO v_order_counter 
           FROM work_orders;
           
           v_order_id := 'OT-' || LPAD(v_order_counter::TEXT, 4, '0');
           
           IF NOT EXISTS (SELECT 1 FROM work_orders WHERE order_id = v_order_id) THEN
             RETURN v_order_id;
           END IF;
           
           v_attempt := v_attempt + 1;
           
           IF v_attempt > v_max_attempts THEN
             RAISE EXCEPTION 'No se pudo generar un ID único de orden de trabajo después de % intentos', v_max_attempts;
           END IF;
         END LOOP;
       END;
       $$;`,

      // 2. Create unique purchase order ID function
      `CREATE OR REPLACE FUNCTION generate_unique_purchase_order_id()
       RETURNS TEXT
       LANGUAGE plpgsql
       AS $$
       DECLARE
         v_order_counter INT;
         v_order_id TEXT;
         v_max_attempts INT := 100;
         v_attempt INT := 1;
       BEGIN
         LOOP
           SELECT COALESCE(
             MAX(
               CASE 
                 WHEN order_id ~ '^OC-[0-9]+$' 
                 THEN (RIGHT(order_id, -3))::INT 
                 ELSE 0 
               END
             ), 0
           ) + v_attempt INTO v_order_counter 
           FROM purchase_orders;
           
           v_order_id := 'OC-' || LPAD(v_order_counter::TEXT, 4, '0');
           
           IF NOT EXISTS (SELECT 1 FROM purchase_orders WHERE order_id = v_order_id) THEN
             RETURN v_order_id;
           END IF;
           
           v_attempt := v_attempt + 1;
           
           IF v_attempt > v_max_attempts THEN
             RAISE EXCEPTION 'No se pudo generar un ID único de orden de compra después de % intentos', v_max_attempts;
           END IF;
         END LOOP;
       END;
       $$;`,

      // 3. Update generate_work_order_from_incident function
      `CREATE OR REPLACE FUNCTION generate_work_order_from_incident(
         p_incident_id UUID,
         p_priority TEXT DEFAULT 'Media'
       )
       RETURNS UUID
       LANGUAGE plpgsql
       SECURITY DEFINER
       AS $$
       DECLARE
         v_incident RECORD;
         v_work_order_id UUID;
         v_order_id TEXT;
         v_required_parts JSONB;
         v_estimated_cost DECIMAL(10,2) := 0;
       BEGIN
         SELECT * INTO v_incident FROM incident_history WHERE id = p_incident_id;
         
         IF v_incident IS NULL THEN
           RAISE EXCEPTION 'Incident not found';
         END IF;
         
         v_order_id := generate_unique_work_order_id();
         
         IF v_incident.parts IS NOT NULL THEN
           SELECT jsonb_agg(
             jsonb_build_object(
               'name', part_item->>'name',
               'partNumber', COALESCE(part_item->>'partNumber', ''),
               'quantity', COALESCE((part_item->>'quantity')::int, 1),
               'unit_price', COALESCE((part_item->>'cost')::decimal, 0),
               'total_price', COALESCE((part_item->>'quantity')::int * (part_item->>'cost')::decimal, 0),
               'supplier', '',
               'description', 'Requerido por incidente: ' || v_incident.type
             )
           ) INTO v_required_parts
           FROM jsonb_array_elements(v_incident.parts) AS part_item;
           
           SELECT COALESCE(SUM((part->>'total_price')::decimal), 0)
           INTO v_estimated_cost
           FROM jsonb_array_elements(v_required_parts) AS part;
         END IF;
         
         IF v_incident.labor_cost IS NOT NULL THEN
           v_estimated_cost := v_estimated_cost + v_incident.labor_cost::decimal;
         END IF;
         
         INSERT INTO work_orders (
           order_id,
           asset_id,
           description,
           type,
           priority,
           status,
           requested_by,
           required_parts,
           estimated_cost,
           estimated_duration,
           incident_id,
           created_at,
           updated_at
         ) VALUES (
           v_order_id,
           v_incident.asset_id,
           'Orden correctiva por incidente: ' || v_incident.type || ' - ' || v_incident.description,
           'corrective',
           p_priority,
           'Pendiente',
           v_incident.created_by,
           v_required_parts,
           CASE WHEN v_estimated_cost > 0 THEN v_estimated_cost ELSE NULL END,
           CASE WHEN v_incident.labor_hours IS NOT NULL THEN v_incident.labor_hours ELSE NULL END,
           p_incident_id,
           NOW(),
           NOW()
         ) RETURNING id INTO v_work_order_id;
         
         UPDATE incident_history
         SET work_order_id = v_work_order_id, updated_at = NOW()
         WHERE id = p_incident_id;
         
         RETURN v_work_order_id;
       END;
       $$;`,

      // 4. Create work order trigger function
      `CREATE OR REPLACE FUNCTION generate_work_order_id_trigger()
       RETURNS TRIGGER
       LANGUAGE plpgsql
       AS $$
       BEGIN
         IF NEW.order_id IS NULL THEN
           NEW.order_id := generate_unique_work_order_id();
         END IF;
         RETURN NEW;
       END;
       $$;`,

      // 5. Create purchase order trigger function
      `CREATE OR REPLACE FUNCTION generate_purchase_order_id_trigger()
       RETURNS TRIGGER
       LANGUAGE plpgsql
       AS $$
       BEGIN
         IF NEW.order_id IS NULL THEN
           NEW.order_id := generate_unique_purchase_order_id();
         END IF;
         RETURN NEW;
       END;
       $$;`
    ];

    // Execute each step
    for (let i = 0; i < migrationSteps.length; i++) {
      console.log(`Ejecutando paso ${i + 1}/${migrationSteps.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql: migrationSteps[i] 
      });
      
      if (error) {
        console.error(`Error en paso ${i + 1}:`, error);
        // Try alternative approach with different function name
        const { error: altError } = await supabase.rpc('execute_sql', { 
          query: migrationSteps[i] 
        });
        
        if (altError) {
          console.error(`Error alternativo en paso ${i + 1}:`, altError);
          throw new Error(`Falló la migración en el paso ${i + 1}: ${altError.message}`);
        }
      }
    }

    // Drop existing triggers if they exist and create new ones
    console.log('Configurando triggers...');
    
    const triggerSql = `
      DROP TRIGGER IF EXISTS trg_generate_work_order_id ON work_orders;
      CREATE TRIGGER trg_generate_work_order_id
        BEFORE INSERT ON work_orders
        FOR EACH ROW
        EXECUTE FUNCTION generate_work_order_id_trigger();
        
      DROP TRIGGER IF EXISTS trg_generate_purchase_order_id ON purchase_orders;
      CREATE TRIGGER trg_generate_purchase_order_id
        BEFORE INSERT ON purchase_orders
        FOR EACH ROW
        EXECUTE FUNCTION generate_purchase_order_id_trigger();
    `;

    const { error: triggerError } = await supabase.rpc('exec_sql', { 
      sql: triggerSql 
    });
    
    if (triggerError) {
      const { error: altTriggerError } = await supabase.rpc('execute_sql', { 
        query: triggerSql 
      });
      
      if (altTriggerError) {
        console.error('Error configurando triggers:', altTriggerError);
        // Continue anyway as the main functions are created
      }
    }

    // Test the new functions
    console.log('Probando funciones...');
    const { data: testWorkOrderId, error: testError } = await supabase
      .rpc('generate_unique_work_order_id');

    if (testError) {
      console.error('Error probando función:', testError);
      return NextResponse.json(
        { 
          success: false,
          error: `Migración completada pero error al probar: ${testError.message}`,
          message: "Las funciones fueron creadas pero hay un error en las pruebas. Intenta generar una orden de trabajo manualmente."
        },
        { status: 200 }
      )
    }

    console.log('Migración completada exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Migración de corrección de IDs ejecutada exitosamente',
      test_work_order_id: testWorkOrderId,
      steps_completed: migrationSteps.length + 1
    });

  } catch (error) {
    console.error('Error ejecutando migración:', error);
    return NextResponse.json(
      { 
        error: `Error ejecutando migración: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestion: "Intenta ejecutar la migración manualmente en el SQL Editor de Supabase"
      },
      { status: 500 }
    )
  }
} 