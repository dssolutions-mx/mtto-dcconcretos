-- =====================================================
-- Import Plant 2 (Tijuana) Inventory - Data Import
-- =====================================================

-- Aceites y Lubricantes (Consumibles)
INSERT INTO inventory_parts (part_number, name, description, category, unit_of_measure, manufacturer, specifications, is_active) VALUES
('ACE-0001', 'Aceite para compresor', 'Marca: Mexicana Lubricantes', 'Consumible', 'liters', 'Mexicana Lubricantes', '{}', true),
('ACE-0002', 'Grasa para generadora', 'Marca: Mexicana Lubricantes', 'Consumible', 'kg', 'Mexicana Lubricantes', '{}', true),
('ACE-0003', 'Aceite para diferencial - 85w140', 'Marca: Fleetrite', 'Consumible', 'liters', 'Fleetrite', '{"spec": "85w140"}', true),
('ACE-0004', 'Aceite para compresor', 'Marca: Chevron', 'Consumible', 'liters', 'Chevron', '{}', true),
('ACE-0005', 'Aceite de motor para Cat 938G - 15w40', 'Marca: Caterpillar', 'Consumible', 'liters', 'Caterpillar', '{"spec": "15w40"}', true),
('ACE-0006', 'Anticongelante international - 50/50', 'Marca: International', 'Consumible', 'liters', 'International', '{"spec": "50/50"}', true),
('ACE-0007', 'Aceite Hidraulico - Rojo', 'Marca: International', 'Consumible', 'liters', 'International', '{"spec": "Rojo"}', true),
('ACE-0008', 'Acido', 'Marca: Soluciones Quimicas', 'Consumible', 'liters', 'Soluciones Quimicas', '{}', true),
('ACE-0009', 'Lubricante Eaton - 15w90', 'Marca: Eaton', 'Consumible', 'liters', 'Eaton', '{"spec": "15w90"}', true),
('ACE-0010', 'Aceite para diferencial y transmision manual - 85w140', 'Marca: Genérico', 'Consumible', 'liters', null, '{"spec": "85w140"}', true),
('ACE-0011', 'Aceite para Bomba International - 15w40', 'Marca: International', 'Consumible', 'liters', 'International', '{"spec": "15w40"}', true),
('ACE-0012', 'Aceite de transmision Cat 938G', 'Marca: Caterpillar', 'Consumible', 'liters', 'Caterpillar', '{}', true),
('ACE-0013', 'Anticongelante para generadora - Azul', 'Marca: Cummins', 'Consumible', 'liters', 'Cummins', '{"spec": "Azul"}', true),
('ACE-0014', 'Aceite hidraulico para international', 'Marca: International', 'Consumible', 'liters', 'International', '{}', true),
('ACE-0015', 'Aceite Hidraulico para bomba sustra Sitrak - ISO VG 68', 'Marca: Mobil', 'Consumible', 'liters', 'Mobil', '{"spec": "ISO VG 68"}', true),
('ACE-0016', 'Aceite de motor para John Deer - 15w40', 'Marca: John Deer', 'Consumible', 'liters', 'John Deer', '{"spec": "15w40"}', true),
('ACE-0017', 'Aceite de diferencial para Sitrak - 75W90', 'Marca: Genérico', 'Consumible', 'liters', null, '{"spec": "75W90"}', true),
('ACE-0018', 'Aceite de diferencial para Sitrak - 75W80', 'Marca: Genérico', 'Consumible', 'liters', null, '{"spec": "75W80"}', true),
('ACE-0019', 'Aceite de motor para Sitrak - 10W40', 'Marca: Scania', 'Consumible', 'liters', 'Scania', '{"spec": "10W40"}', true),
('ACE-0020', 'Anticongelante para Sitrak - 50/50 rojo', 'Marca: Yukoil', 'Consumible', 'liters', 'Yukoil', '{"spec": "50/50 rojo"}', true),
('ACE-0021', 'Anticongelante para International', 'Marca: International', 'Consumible', 'liters', 'International', '{}', true),
('ACE-0022', 'Aceite de diferencial para International', 'Marca: International', 'Consumible', 'liters', 'International', '{}', true)
ON CONFLICT (part_number) DO NOTHING;

-- Filtros (Repuestos)
INSERT INTO inventory_parts (part_number, name, description, category, unit_of_measure, manufacturer, specifications, is_active) VALUES
('FIL-0001', 'Filtro de Aire secundario - 0021-Corto', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{"spec": "0021-Corto"}', true),
('FIL-0002', 'Filtro de aire p/s - 0021-corto', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{"spec": "0021-corto"}', true),
('FIL-0003', 'Filtro diesel', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0004', 'Filtro bomba sustra', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0005', 'Filtro de aceite', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0006', 'Filtro secundario largo', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0007', 'Filtro separador de agua', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0008', 'Filtro de a/c', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0009', 'Filtro direccion hidraulica', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0010', 'Filtro de transmision ZF (intarder)', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0011', 'Filtro de transmision automatica', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0012', 'Filtro de urea', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0013', 'Filtro secador de aire', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0014', 'Banda de motor', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0015', 'Filtro de aire corto primario-secundario', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{}', true),
('FIL-0016', 'Filtro de aire primario largo - 00-61', 'Marca: Sitrak', 'Repuesto', 'pcs', 'Sitrak', '{"spec": "00-61"}', true),
('FIL-0017', 'Filtro de aire secundario', 'Marca: International', 'Repuesto', 'pcs', 'International', '{}', true),
('FIL-0018', 'Filtro hidraulico', 'Marca: Fleetgraud', 'Repuesto', 'pcs', 'Fleetgraud', '{}', true),
('FIL-0019', 'Filtro hidraulico', 'Marca: Genérico', 'Repuesto', 'pcs', null, '{}', true),
('FIL-0020', 'Filtro de combustible para cat 938g', 'Marca: Donaldson', 'Repuesto', 'pcs', 'Donaldson', '{}', true),
('FIL-0021', 'Filtro de combustible', 'Marca: Fleetgraud', 'Repuesto', 'pcs', 'Fleetgraud', '{}', true),
('FIL-0022', 'Filtro', 'Marca: Genérico', 'Repuesto', 'pcs', null, '{}', true),
('FIL-0023', 'Filtro lubricante', 'Marca: Fleetgraud', 'Repuesto', 'pcs', 'Fleetgraud', '{}', true),
('FIL-0024', 'Filtro separador', 'Marca: Cummins', 'Repuesto', 'pcs', 'Cummins', '{}', true),
('FIL-0025', 'Filtro de combustible', 'Marca: Donaldson', 'Repuesto', 'pcs', 'Donaldson', '{}', true),
('FIL-0026', 'Filtro', 'Marca: Genérico', 'Repuesto', 'pcs', null, '{}', true),
('FIL-0027', 'Luces de trabajo CAT 938G', 'Marca: CAT', 'Repuesto', 'pcs', 'CAT', '{}', true),
('FIL-0028', 'Filtro John Deer', 'Marca: JD', 'Repuesto', 'pcs', 'JD', '{}', true),
('FIL-0029', 'Filtro', 'Marca: Genérico', 'Repuesto', 'pcs', null, '{}', true),
('FIL-0030', 'Filtro de aire Kenworth', 'Marca: Kenworth', 'Repuesto', 'pcs', 'Kenworth', '{}', true),
('FIL-0031', 'Filtro de aire Primario-secundario', 'Marca: Donaldson', 'Repuesto', 'pcs', 'Donaldson', '{}', true),
('FIL-0032', 'Filtro de aire Secundario', 'Marca: Donaldson', 'Repuesto', 'pcs', 'Donaldson', '{}', true),
('FIL-0033', 'Filtro de aire secundario', 'Marca: Donaldson', 'Repuesto', 'pcs', 'Donaldson', '{}', true),
('FIL-0034', 'Filtro de aire secundario', 'Marca: Donaldson', 'Repuesto', 'pcs', 'Donaldson', '{}', true),
('FIL-0035', 'Filtro de aire secundario', 'Marca: Donaldson', 'Repuesto', 'pcs', 'Donaldson', '{}', true),
('FIL-0036', 'Filtro de aire secundario', 'Marca: Donaldson', 'Repuesto', 'pcs', 'Donaldson', '{}', true),
('FIL-0037', 'Filtro de aire Primario-secundario', 'Marca: Donaldson', 'Repuesto', 'pcs', 'Donaldson', '{}', true),
('FIL-0038', 'Filtro de aire secundario', 'Marca: Donaldson', 'Repuesto', 'pcs', 'Donaldson', '{}', true),
('FIL-0039', 'Filtro de aire Primario-secundario', 'Marca: Donaldson', 'Repuesto', 'pcs', 'Donaldson', '{}', true),
('FIL-0040', 'Turbos', 'Marca: Kenworth', 'Repuesto', 'pcs', 'Kenworth', '{}', true)
ON CONFLICT (part_number) DO NOTHING;

-- Herramientas y EPP
INSERT INTO inventory_parts (part_number, name, description, category, unit_of_measure, manufacturer, is_active) VALUES
('HER-0001', 'LENTES', 'Equipo de protección personal', 'Herramienta', 'pcs', null, true),
('HER-0002', 'MARRO', 'Herramienta de mano', 'Herramienta', 'pcs', null, true),
('HER-0003', 'CASCO', 'Equipo de protección personal', 'Herramienta', 'pcs', null, true),
('HER-0004', 'GUANTES DE LATEX', 'Equipo de protección personal', 'Herramienta', 'pcs', null, true),
('HER-0005', 'GUANTES DE CARNAZA', 'Equipo de protección personal', 'Herramienta', 'pcs', null, true),
('HER-0006', 'BARBIQUEJO', 'Equipo de protección personal', 'Herramienta', 'pcs', null, true),
('HER-0007', 'CINCEL', 'Herramienta de mano', 'Herramienta', 'pcs', null, true),
('HER-0008', 'ESPATULA', 'Herramienta de mano', 'Herramienta', 'pcs', null, true),
('HER-0009', 'PISTOLAS DE AGUA', 'Herramienta de limpieza', 'Herramienta', 'pcs', null, true),
('HER-0010', 'GRASERAS', 'Herramienta de lubricación', 'Herramienta', 'pcs', null, true),
('HER-0011', 'KIT PARA INTERNATIONAL MOD EATON', 'Kit de herramientas especializado', 'Herramienta', 'pcs', 'Eaton', true),
('HER-0012', 'PALANCA SITRAK', 'Herramienta especializada', 'Herramienta', 'pcs', 'Sitrak', true),
('HER-0013', 'BUJIAS', 'Repuesto eléctrico', 'Herramienta', 'pcs', null, true),
('HER-0014', 'GAS PARA AIRE ACONDICIONADO', 'Refrigerante A/C', 'Herramienta', 'pcs', null, true),
('HER-0015', 'VALVULA DE AIRE PARA INTERNATIONAL', 'Repuesto neumático', 'Herramienta', 'pcs', 'International', true),
('HER-0016', 'CAJA DE HERRAMIENTA MARCA HUSKY', 'Set de herramientas - 185 piezas', 'Herramienta', 'pcs', 'Husky', true),
('HER-0017', 'CAJA DE HERRAMIENTA ALMACEN', 'Set de herramientas - 185 piezas', 'Herramienta', 'pcs', null, true),
('HER-0018', 'TURBO KENWORTH', 'Turbocompresor', 'Herramienta', 'pcs', 'Kenworth', true),
('HER-0019', 'CEPILLOS PARA PLANTA', 'Herramienta de limpieza', 'Herramienta', 'pcs', null, true),
('HER-0020', 'CEPILLOS PARA CAMION-LIMPIEZA', 'Herramienta de limpieza', 'Herramienta', 'pcs', null, true)
ON CONFLICT (part_number) DO NOTHING;

-- Now create stock entries for all parts
-- Get the inserted part IDs and create stock
DO $$
DECLARE
  v_warehouse_id UUID := '185233d1-5c96-4fa7-86ed-310677aa8831';
  v_part RECORD;
  v_quantities TEXT[][] := ARRAY[
    -- Aceites (part_number, quantity)
    ['ACE-0001', '19'], ['ACE-0002', '0.25'], ['ACE-0003', '20'], ['ACE-0004', '0.25'],
    ['ACE-0005', '8'], ['ACE-0006', '34'], ['ACE-0007', '10'], ['ACE-0008', '60'],
    ['ACE-0009', '10'], ['ACE-0010', '57'], ['ACE-0011', '17'], ['ACE-0012', '48'],
    ['ACE-0013', '20'], ['ACE-0014', '15'], ['ACE-0015', '76'], ['ACE-0016', '8'],
    ['ACE-0017', '180'], ['ACE-0018', '265'], ['ACE-0019', '69'], ['ACE-0020', '150'],
    ['ACE-0021', '180'], ['ACE-0022', '104'],
    -- Filtros
    ['FIL-0001', '4'], ['FIL-0002', '2'], ['FIL-0003', '8'], ['FIL-0004', '10'],
    ['FIL-0005', '11'], ['FIL-0006', '1'], ['FIL-0007', '11'], ['FIL-0008', '11'],
    ['FIL-0009', '9'], ['FIL-0010', '9'], ['FIL-0011', '4'], ['FIL-0012', '8'],
    ['FIL-0013', '9'], ['FIL-0014', '10'], ['FIL-0015', '8'], ['FIL-0016', '1'],
    ['FIL-0017', '1'], ['FIL-0018', '2'], ['FIL-0019', '1'], ['FIL-0020', '1'],
    ['FIL-0021', '2'], ['FIL-0022', '1'], ['FIL-0023', '1'], ['FIL-0024', '1'],
    ['FIL-0025', '1'], ['FIL-0026', '1'], ['FIL-0027', '2'], ['FIL-0028', '1'],
    ['FIL-0029', '1'], ['FIL-0030', '1'], ['FIL-0031', '1'], ['FIL-0032', '1'],
    ['FIL-0033', '2'], ['FIL-0034', '1'], ['FIL-0035', '2'], ['FIL-0036', '1'],
    ['FIL-0037', '1'], ['FIL-0038', '1'], ['FIL-0039', '1'], ['FIL-0040', '2'],
    -- Herramientas
    ['HER-0001', '13'], ['HER-0002', '6'], ['HER-0003', '2'], ['HER-0004', '4'],
    ['HER-0005', '0'], ['HER-0006', '1'], ['HER-0007', '6'], ['HER-0008', '0'],
    ['HER-0009', '4'], ['HER-0010', '8'], ['HER-0011', '1'], ['HER-0012', '1'],
    ['HER-0013', '1'], ['HER-0014', '1'], ['HER-0015', '1'], ['HER-0016', '185'],
    ['HER-0017', '185'], ['HER-0018', '2'], ['HER-0019', '1'], ['HER-0020', '1']
  ];
  v_qty_row TEXT[];
BEGIN
  FOREACH v_qty_row SLICE 1 IN ARRAY v_quantities
  LOOP
    SELECT id INTO v_part FROM inventory_parts WHERE part_number = v_qty_row[1];
    
    IF v_part IS NOT NULL THEN
      INSERT INTO inventory_stock (
        part_id,
        warehouse_id,
        current_quantity,
        reserved_quantity,
        min_stock_level,
        reorder_point,
        average_unit_cost,
        notes
      ) VALUES (
        v_part,
        v_warehouse_id,
        v_qty_row[2]::NUMERIC,
        0,
        GREATEST(1, ROUND(v_qty_row[2]::NUMERIC * 0.2)), -- 20% of current as min
        GREATEST(2, ROUND(v_qty_row[2]::NUMERIC * 0.3)), -- 30% of current as reorder point
        0, -- Will be updated with actual receipts
        'Inventario inicial - Planta 2 Tijuana'
      )
      ON CONFLICT (part_id, warehouse_id) DO NOTHING;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Inventory import completed for Plant 2';
END $$;
