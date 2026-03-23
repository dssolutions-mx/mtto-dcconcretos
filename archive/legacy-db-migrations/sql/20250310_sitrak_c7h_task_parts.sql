-- Sitrak C7H Mixer Model Alignment - Phase 3: COMPLETE task_parts
-- Criteria: Every task that consumes a part (CAMBIAR, ENGRASAR, Revisar rellenar) per MD LISTA DE INSUMOS
-- Uses inventory codes from import-plant2-inventory-data.sql
-- Run this to REPLACE incomplete task_parts with full coverage

-- ========== CLEANUP: Remove existing task_parts for Sitrak C7H tasks ==========
DELETE FROM task_parts
WHERE task_id IN (
  SELECT mt.id FROM maintenance_tasks mt
  JOIN maintenance_intervals mi ON mi.id = mt.interval_id
  WHERE mi.model_id IN (
    '2979ee1b-0083-4bdc-b56f-3a7a967592d7',
    '4508a908-2f28-48af-a06a-5cb8f34ac7bc',
    'bc05edde-40d2-445e-abb5-d1489fce93e3'
  )
);

-- ========== 100h ==========
-- MANUAL: HW25 aceite 15L + filtro (MD: Cambiar aceite y filtro transmisión HW25)
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Aceite transmisión HW25', 'ACE-0017', 15
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id = '2979ee1b-0083-4bdc-b56f-3a7a967592d7'
AND mi.interval_value = 100 AND mt.description LIKE '%transmisión HW25%';

-- MANUAL/AUTO/LONG: AC16 aceite 42L (22+20)
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Aceite ejes AC16', 'ACE-0017', 42
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 100 AND mt.description LIKE '%ejes reducción cubo AC16%';

-- ========== 300h ==========
-- Filtro aire primario (MD: 300 hr)
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro aire primario', 'FIL-0016', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 300 AND mt.description LIKE '%filtro aire primario%';

-- Grasa lubricación general 0.5 kg (MD: En grasas general)
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Grasa NLGI-2', 'ACE-0002', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 300 AND mt.description LIKE '%Engrasar todos los puntos%';

-- Crucetas cardán 0.2 kg (MD: Crucetas cardán mixer)
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Grasa crucetas cardán', 'ACE-0002', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 300 AND mt.description LIKE '%crucetas cardán%';

-- Lubricación cubos rellenar 0.625 kg/lado (MD: Lubricación cubos)
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Grasa NLGI-3 cubos', 'ACE-0002', 2
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 300 AND mt.description LIKE '%lubricación cubos%';

-- ========== 600h ==========
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro aire secundario', 'FIL-0001', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 600 AND mt.description LIKE '%filtro aire secundario%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro combustible KSC', 'FIL-0003', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 600 AND mt.description LIKE '%filtro principal combustible%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro separador agua', 'FIL-0007', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 600 AND mt.description LIKE '%filtro principal combustible%';

-- SCR cambiar si necesario (1 unit for potential change)
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro urea SCR', 'FIL-0012', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 600 AND mt.description LIKE '%sistema SCR%';

-- ========== 900h ==========
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Aceite motor', 'ACE-0019', 42
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 900 AND mt.description LIKE '%aceite y filtro motor%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro aceite motor', 'FIL-0005', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 900 AND mt.description LIKE '%aceite y filtro motor%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro aire primario', 'FIL-0016', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 900 AND mt.description LIKE '%filtro aire primario%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro sistema SCR', 'FIL-0012', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 900 AND mt.description LIKE '%filtro principal sistema SCR%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Aceite reductor ZF mixer', 'ACE-0017', 18
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 900 AND mt.description LIKE '%aceite reductor ZF mixer%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Grasa lubricación', 'ACE-0002', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 900 AND mt.description LIKE '%Engrasar lubricación general%';

-- ========== 1200h ==========
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro aire secundario', 'FIL-0001', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1200 AND mt.description LIKE '%filtro aire secundario%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro combustible', 'FIL-0003', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1200 AND mt.description LIKE '%filtros combustible%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro separador', 'FIL-0007', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1200 AND mt.description LIKE '%filtros combustible%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro antipolen A/C', 'FIL-0008', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1200 AND (mt.description LIKE '%antipolen%' OR mt.description LIKE '%A/C cabina%');

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Grasa lubricación', 'ACE-0002', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1200 AND mt.description LIKE '%Engrasar lubricación%';

-- ========== 1500h, 2100h, 3000h, 3300h (estándar) ==========
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Grasa lubricación', 'ACE-0002', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value IN (1500, 2100, 3000, 3300)
AND mt.description LIKE '%Engrasar lubricación%';

-- ========== 1800h ==========
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro aire primario', 'FIL-0016', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%filtro aire primario%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro combustible', 'FIL-0003', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%filtros combustible%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro separador', 'FIL-0007', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%filtros combustible%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro sistema SCR', 'FIL-0012', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%filtro principal sistema SCR%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Banda motor', 'FIL-0014', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%correa motor%';

-- Transmisión HW25 (MANUAL only)
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Aceite transmisión HW25', 'ACE-0017', 15
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id = '2979ee1b-0083-4bdc-b56f-3a7a967592d7'
AND mi.interval_value = 1800 AND mt.description LIKE '%aceite y filtro transmisión HW25%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro transmisión HW25', 'FIL-0011', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id = '2979ee1b-0083-4bdc-b56f-3a7a967592d7'
AND mi.interval_value = 1800 AND mt.description LIKE '%aceite y filtro transmisión HW25%';

-- Transmisión ZF Intarder (AUTO/LONG)
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Aceite transmisión ZF Intarder', 'ACE-0018', 25
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%aceite y filtro Intarder transmisión ZF%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro transmisión ZF', 'FIL-0010', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%aceite y filtro Intarder transmisión ZF%';

-- Dirección 6x4 (all 3): aceite + filtro
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Aceite dirección ATF', 'ACE-0007', 2
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%aceite y filtro dirección%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro dirección', 'FIL-0009', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%aceite y filtro dirección%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Cartucho secador neumático', 'FIL-0013', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%secador sistema neumático%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Aceite bomba EATON', 'ACE-0015', 16
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%aceite y filtro bomba EATON%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro bomba sustra', 'FIL-0004', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%aceite y filtro bomba EATON%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Aceite Dynachute', 'ACE-0015', 4
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%aceite Dynachute mixer%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Grasa lubricación', 'ACE-0002', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 1800 AND mt.description LIKE '%Engrasar lubricación%';

-- ========== 2400h ==========
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro aire secundario', 'FIL-0001', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 2400 AND mt.description LIKE '%filtro aire secundario%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro combustible', 'FIL-0003', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 2400 AND mt.description LIKE '%filtros combustible%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro separador', 'FIL-0007', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 2400 AND mt.description LIKE '%filtros combustible%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro antipolen A/C', 'FIL-0008', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 2400 AND mt.description LIKE '%antipolen%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Grasa lubricación', 'ACE-0002', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 2400 AND mt.description LIKE '%Engrasar lubricación%';

-- ========== 2700h ==========
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Aceite motor', 'ACE-0019', 42
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 2700 AND mt.description LIKE '%aceite y filtro motor%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro aceite motor', 'FIL-0005', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 2700 AND mt.description LIKE '%aceite y filtro motor%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro aire primario', 'FIL-0016', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 2700 AND mt.description LIKE '%filtro aire primario%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro sistema SCR', 'FIL-0012', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 2700 AND mt.description LIKE '%filtro sistema SCR%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Grasa lubricación', 'ACE-0002', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 2700 AND mt.description LIKE '%Engrasar lubricación%';

-- ========== 3600h ==========
INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Aceite motor', 'ACE-0019', 42
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%aceite y filtro motor%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro aceite motor', 'FIL-0005', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%aceite y filtro motor%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro aire primario', 'FIL-0016', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%filtro aire primario%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro aire secundario', 'FIL-0001', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%filtro aire secundario%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro combustible', 'FIL-0003', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%filtros combustible%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro separador', 'FIL-0007', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%filtros combustible%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro sistema SCR', 'FIL-0012', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%filtro sistema SCR%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Refrigerante', 'ACE-0020', 55
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%refrigerante completo%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Grasa lubricación cubos', 'ACE-0002', 2
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%grasa completa lubricación cubos%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Aceite eje equilibrio 6x4', 'ACE-0017', 2
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%aceite eje equilibrio%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Gas A/C R134a', 'HER-0014', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%gas A/C cabina%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Filtro antipolen A/C', 'FIL-0008', 1
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%filtro antipolen%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Grasa pista mezclador', 'ACE-0002', 2
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%pista mezclador%';

INSERT INTO task_parts (task_id, name, part_number, quantity)
SELECT mt.id, 'Grasa puntos mixer', 'ACE-0002', 2
FROM maintenance_tasks mt
JOIN maintenance_intervals mi ON mi.id = mt.interval_id
WHERE mi.model_id IN ('2979ee1b-0083-4bdc-b56f-3a7a967592d7','4508a908-2f28-48af-a06a-5cb8f34ac7bc','bc05edde-40d2-445e-abb5-d1489fce93e3')
AND mi.interval_value = 3600 AND mt.description LIKE '%todos los puntos mixer%';
