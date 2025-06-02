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

    console.log('Ejecutando reparación de IDs duplicados...')

    // First, create the fix function if it doesn't exist
    const fixFunctionSql = `
      CREATE OR REPLACE FUNCTION fix_duplicate_order_ids()
      RETURNS TEXT
      LANGUAGE plpgsql
      AS $$
      DECLARE
        duplicate_work_order RECORD;
        duplicate_purchase_order RECORD;
        new_id TEXT;
        fixed_count INT := 0;
      BEGIN
        -- Fix duplicate work orders
        FOR duplicate_work_order IN 
          SELECT order_id, array_agg(id) as ids
          FROM work_orders 
          WHERE order_id IS NOT NULL
          GROUP BY order_id 
          HAVING COUNT(*) > 1
        LOOP
          -- Keep the first ID, change the others
          FOR i IN 2..array_length(duplicate_work_order.ids, 1) LOOP
            new_id := generate_unique_work_order_id();
            UPDATE work_orders 
            SET order_id = new_id 
            WHERE id = duplicate_work_order.ids[i];
            fixed_count := fixed_count + 1;
          END LOOP;
        END LOOP;
        
        -- Fix duplicate purchase orders
        FOR duplicate_purchase_order IN 
          SELECT order_id, array_agg(id) as ids
          FROM purchase_orders 
          WHERE order_id IS NOT NULL
          GROUP BY order_id 
          HAVING COUNT(*) > 1
        LOOP
          -- Keep the first ID, change the others
          FOR i IN 2..array_length(duplicate_purchase_order.ids, 1) LOOP
            new_id := generate_unique_purchase_order_id();
            UPDATE purchase_orders 
            SET order_id = new_id 
            WHERE id = duplicate_purchase_order.ids[i];
            fixed_count := fixed_count + 1;
          END LOOP;
        END LOOP;
        
        RETURN 'Se corrigieron ' || fixed_count || ' IDs duplicados';
      END;
      $$;
    `;

    // Create the function
    const { error: functionError } = await supabase.rpc('exec_sql', { 
      sql: fixFunctionSql 
    });
    
    if (functionError) {
      const { error: altFunctionError } = await supabase.rpc('execute_sql', { 
        query: fixFunctionSql 
      });
      
      if (altFunctionError) {
        console.error('Error creando función de reparación:', altFunctionError);
        throw new Error(`Error creando función de reparación: ${altFunctionError.message}`);
      }
    }

    // Execute the fix function
    const { data: result, error: execError } = await supabase
      .rpc('fix_duplicate_order_ids');

    if (execError) {
      console.error('Error ejecutando reparación:', execError);
      throw new Error(`Error ejecutando reparación: ${execError.message}`);
    }

    console.log('Reparación completada:', result);

    return NextResponse.json({
      success: true,
      message: 'Reparación de IDs duplicados completada',
      result: result
    });

  } catch (error) {
    console.error('Error reparando IDs duplicados:', error);
    return NextResponse.json(
      { 
        error: `Error reparando IDs duplicados: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestion: "Verifica que la migración principal haya sido ejecutada primero"
      },
      { status: 500 }
    )
  }
} 