-- Sitrak C7H Mixer - Refine Task Descriptions
-- Criteria:
-- 1. Tasks WITH repuestos: short description (action + component), remove redundant quantities/specs
-- 2. Tasks WITHOUT repuestos: keep capacity, params, warnings
-- 3. Unify style between intervals (300h vs 600h)
-- Run AFTER 20250310_sitrak_c7h_mixer_align.sql and BEFORE or AFTER 20250310_sitrak_c7h_task_parts.sql
-- (task_parts links by task_id; description updates do not affect it. LIKE patterns remain valid.)

-- ========== 100h ==========
-- MANUAL: HW25 + AC16 (both have repuestos - simplify)
UPDATE maintenance_tasks SET description = 'Cambiar aceite y filtro transmisión HW25'
WHERE interval_id = 'c2b70f49-3344-4409-b655-4c1185684747'
AND description = 'Cambiar aceite y filtro completo transmisión HW25. 15 L, Sintético SAE 75W90, M-342 S1/S2';

UPDATE maintenance_tasks SET description = 'Cambiar aceite ejes reducción cubo AC16'
WHERE interval_id = 'c2b70f49-3344-4409-b655-4c1185684747'
AND description = 'Cambiar aceite completo ejes reducción cubo AC16. 22 + 20 L, Sintético SAE 75W90, M342 S1/S2';

UPDATE maintenance_tasks SET description = 'Cambiar aceite ejes reducción cubo AC16'
WHERE interval_id IN ('6ccc5fba-b0ae-4e86-b158-4c0dff810197', 'd7791464-f579-4d2b-a7d2-89e4c067e3ec')
AND description = 'Cambiar aceite completo ejes reducción cubo AC16. 22 + 20 L, Sintético SAE 75W90, M342 S1/S2';

-- Servo: no repuestos, keep param
-- "Revisar y calibrar carrera servo embrague. Rango 27-30mm" - already good

-- ========== 300h ==========
-- Filtro aire primario: has repuesto, keep procedure (no change - already correct)

-- Engrasar todos los puntos: has repuesto, simplify
UPDATE maintenance_tasks SET description = 'Engrasar todos los puntos de lubricación. Crucetas, dirección'
WHERE interval_id IN ('504e757a-61fe-4153-8828-f73846b34fca', '5bd2c3c8-375c-4c83-bf0b-14136aef74ba', '46044069-4d32-4c58-9bf3-e64546432d57')
AND description = 'Engrasar todos los puntos de lubricación. 0.5 kg NLGI-2, crucetas, dirección';

-- Crucetas cardán: has repuesto, simplify
UPDATE maintenance_tasks SET description = 'Engrasar crucetas cardán mixer'
WHERE interval_id IN ('504e757a-61fe-4153-8828-f73846b34fca', '5bd2c3c8-375c-4c83-bf0b-14136aef74ba', '46044069-4d32-4c58-9bf3-e64546432d57')
AND description = 'Engrasar crucetas cardán mixer. 0.2 kg NLGI-2';

-- Lubricación cubos: has repuesto, simplify
UPDATE maintenance_tasks SET description = 'Revisar y rellenar lubricación cubos'
WHERE interval_id IN ('504e757a-61fe-4153-8828-f73846b34fca', '5bd2c3c8-375c-4c83-bf0b-14136aef74ba', '46044069-4d32-4c58-9bf3-e64546432d57')
AND description = 'Revisar y rellenar lubricación cubos. 0.625 kg/lado NLGI-3';

-- ========== 600h: Unify with 300h style (add params where missing) ==========
-- 600h motor: only "Revisar nivel" per MD, not "rellenar" - keep as is

UPDATE maintenance_tasks SET description = 'Revisar terminales esféricas eje delantero. Juego radial máx 0.25mm'
WHERE interval_id IN ('a9f44c76-10ab-4933-b3fa-262e204e46b9', '498f048e-e0c1-43b4-a29c-0af777b05f69', 'ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93')
AND description = 'Revisar terminales esféricas eje delantero';

UPDATE maintenance_tasks SET description = 'Calibrar carrera servo embrague. 27-30mm, alto riesgo si <23mm'
WHERE interval_id IN ('a9f44c76-10ab-4933-b3fa-262e204e46b9', '498f048e-e0c1-43b4-a29c-0af777b05f69', 'ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93')
AND description = 'Calibrar carrera servo embrague. 27-30mm';

UPDATE maintenance_tasks SET description = 'Revisar y ajustar chicotes cambios. Verificar enrutado cables'
WHERE interval_id IN ('a9f44c76-10ab-4933-b3fa-262e204e46b9', '498f048e-e0c1-43b4-a29c-0af777b05f69', 'ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93')
AND description = 'Revisar y ajustar chicotes cambios';

UPDATE maintenance_tasks SET description = 'Revisar estado lubricación cubos. 0.625 kg/lado NLGI-3'
WHERE interval_id IN ('a9f44c76-10ab-4933-b3fa-262e204e46b9', '498f048e-e0c1-43b4-a29c-0af777b05f69', 'ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93')
AND description = 'Revisar estado lubricación cubos';

-- Filtro combustible: has repuestos, remove redundant "Filtro KSC + separador agua"
UPDATE maintenance_tasks SET description = 'Cambiar filtro principal combustible y separador'
WHERE interval_id IN ('a9f44c76-10ab-4933-b3fa-262e204e46b9', '498f048e-e0c1-43b4-a29c-0af777b05f69', 'ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93')
AND description = 'Cambiar filtro principal combustible y separador. Filtro KSC + separador agua';

-- ========== 900h: Tasks with repuestos - simplify ==========
UPDATE maintenance_tasks SET description = 'Cambiar aceite y filtro motor completo'
WHERE interval_id IN ('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'c2c9d0cd-86cf-464f-ae98-d6908880d0e6')
AND description = 'Cambiar aceite y filtro motor completo. 42 L, Sintético SAE 10W40, M3277/M3477';

-- Filtro aire primario, filtro SCR: already have procedure, no change

UPDATE maintenance_tasks SET description = 'Cambiar aceite reductor ZF mixer'
WHERE interval_id IN ('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'c2c9d0cd-86cf-464f-ae98-d6908880d0e6')
AND description = 'Cambiar aceite reductor ZF mixer. 17.5 L, SAE 75W90';

UPDATE maintenance_tasks SET description = 'Engrasar lubricación general'
WHERE interval_id IN ('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'c2c9d0cd-86cf-464f-ae98-d6908880d0e6')
AND description = 'Engrasar lubricación general. 0.5 kg';

-- ========== 1800h: Tasks with repuestos - simplify ==========
UPDATE maintenance_tasks SET description = 'Cambiar aceite y filtro transmisión HW25'
WHERE interval_id = '9a70a424-e705-49c4-a825-e6c9c66acc75'
AND description = 'Cambiar aceite y filtro transmisión HW25. 15 L, SAE 75W90, M-342 S1/S2';

UPDATE maintenance_tasks SET description = 'Cambiar aceite y filtro Intarder transmisión ZF'
WHERE interval_id IN ('ad110823-588d-45ed-a948-79b1a2c100f6', '7941ed67-67cf-44bb-9d23-8661ed195097')
AND description = 'Cambiar aceite y filtro Intarder transmisión ZF. 25 L, SAE 75W80, M-341-Z4';

UPDATE maintenance_tasks SET description = 'Cambiar aceite y filtro dirección 6x4'
WHERE interval_id IN ('9a70a424-e705-49c4-a825-e6c9c66acc75', 'ad110823-588d-45ed-a948-79b1a2c100f6', '7941ed67-67cf-44bb-9d23-8661ed195097')
AND description = 'Cambiar aceite y filtro dirección 6x4. 2 L, ATF DEXRON III, M-339';

UPDATE maintenance_tasks SET description = 'Cambiar aceite y filtro bomba EATON mixer'
WHERE interval_id IN ('9a70a424-e705-49c4-a825-e6c9c66acc75', 'ad110823-588d-45ed-a948-79b1a2c100f6', '7941ed67-67cf-44bb-9d23-8661ed195097')
AND description = 'Cambiar aceite y filtro bomba EATON mixer. 16 L, BT26/H68 - ISO VG68';

UPDATE maintenance_tasks SET description = 'Cambiar aceite Dynachute mixer'
WHERE interval_id IN ('9a70a424-e705-49c4-a825-e6c9c66acc75', 'ad110823-588d-45ed-a948-79b1a2c100f6', '7941ed67-67cf-44bb-9d23-8661ed195097')
AND description = 'Cambiar aceite Dynachute mixer. 4 L, BT26/H68 - ISO VG68';

UPDATE maintenance_tasks SET description = 'Cambiar fluido embrague completo. DOT 4'
WHERE interval_id IN ('9a70a424-e705-49c4-a825-e6c9c66acc75', 'ad110823-588d-45ed-a948-79b1a2c100f6', '7941ed67-67cf-44bb-9d23-8661ed195097')
AND description = 'Cambiar fluido embrague completo. 0.5 L DOT 4, M-3289';

UPDATE maintenance_tasks SET description = 'Engrasar lubricación general'
WHERE interval_id IN ('9a70a424-e705-49c4-a825-e6c9c66acc75', 'ad110823-588d-45ed-a948-79b1a2c100f6', '7941ed67-67cf-44bb-9d23-8661ed195097')
AND description = 'Engrasar lubricación general. 0.5 kg';

-- ========== 2700h ==========
UPDATE maintenance_tasks SET description = 'Cambiar aceite y filtro motor'
WHERE interval_id IN ('9a3028ca-066c-4043-9afa-2fa2dd536172', 'c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'a6738141-22be-489f-ab3f-23a0e2e9094d')
AND description = 'Cambiar aceite y filtro motor. 42 L, SAE 10W40';

UPDATE maintenance_tasks SET description = 'Engrasar lubricación general'
WHERE interval_id IN ('9a3028ca-066c-4043-9afa-2fa2dd536172', 'c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'a6738141-22be-489f-ab3f-23a0e2e9094d')
AND description = 'Engrasar lubricación general. 0.5 kg';

-- ========== 3600h ==========
UPDATE maintenance_tasks SET description = 'Cambiar aceite y filtro motor'
WHERE interval_id IN ('f37916a3-bac0-43ba-ae1c-3dea38126ee8', '204c76db-b192-4f1b-9de0-aaa2aaf71d31', '73438431-dd6c-4f26-ae0a-9f1d53a8954b')
AND description = 'Cambiar aceite y filtro motor. 42 L, SAE 10W40';

-- Refrigerante: keep spec MAN-324, -37°C (procedural) - no change

UPDATE maintenance_tasks SET description = 'Cambiar grasa completa lubricación cubos. Tuercas, chavetas, reténes'
WHERE interval_id IN ('f37916a3-bac0-43ba-ae1c-3dea38126ee8', '204c76db-b192-4f1b-9de0-aaa2aaf71d31', '73438431-dd6c-4f26-ae0a-9f1d53a8954b')
AND description = 'Cambiar grasa completa lubricación cubos. 1.3 kg, tuercas, chavetas, reténes';

UPDATE maintenance_tasks SET description = 'Cambiar aceite eje equilibrio 6x4'
WHERE interval_id IN ('f37916a3-bac0-43ba-ae1c-3dea38126ee8', '204c76db-b192-4f1b-9de0-aaa2aaf71d31', '73438431-dd6c-4f26-ae0a-9f1d53a8954b')
AND description = 'Cambiar aceite eje equilibrio 6x4. 2 L, SAE 75W90';

UPDATE maintenance_tasks SET description = 'Cambiar gas A/C cabina completo. R134a, usar recuperador'
WHERE interval_id IN ('f37916a3-bac0-43ba-ae1c-3dea38126ee8', '204c76db-b192-4f1b-9de0-aaa2aaf71d31', '73438431-dd6c-4f26-ae0a-9f1d53a8954b')
AND description = 'Cambiar gas A/C cabina completo. 0.7 kg, R134a, usar recuperador';

UPDATE maintenance_tasks SET description = 'Engrasar pista mezclador completo. Hasta cubrir circunferencia'
WHERE interval_id IN ('f37916a3-bac0-43ba-ae1c-3dea38126ee8', '204c76db-b192-4f1b-9de0-aaa2aaf71d31', '73438431-dd6c-4f26-ae0a-9f1d53a8954b')
AND description = 'Engrasar pista mezclador completo. 2 kg hasta cubrir circunferencia';

-- Engrasar puntos mixer: keep 2 kg NLGI-2 (procedure spec) - no change
