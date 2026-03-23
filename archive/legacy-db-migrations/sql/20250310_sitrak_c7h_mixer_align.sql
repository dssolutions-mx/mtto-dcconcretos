-- Sitrak C7H Mixer Model Alignment - Phase 2: Replace Tasks
-- Aligns MANUAL (HW25), AUTOMATICO (ZF), and SIT-C7H-LONG CHASIS (ZF) with MD matrix

-- ========== 100h INTERVAL ==========
-- MANUAL: HW25 + AC16 + Servo
DELETE FROM maintenance_tasks WHERE interval_id = 'c2b70f49-3344-4409-b655-4c1185684747';
INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('c2b70f49-3344-4409-b655-4c1185684747', 'Cambiar aceite y filtro completo transmisión HW25. 15 L, Sintético SAE 75W90, M-342 S1/S2', 'Reemplazo'),
('c2b70f49-3344-4409-b655-4c1185684747', 'Cambiar aceite completo ejes reducción cubo AC16. 22 + 20 L, Sintético SAE 75W90, M342 S1/S2', 'Reemplazo'),
('c2b70f49-3344-4409-b655-4c1185684747', 'Revisar y calibrar carrera servo embrague. Rango 27-30mm', 'Calibración');

-- AUTOMATICO: AC16 + Servo (no HW25 - uses ZF)
DELETE FROM maintenance_tasks WHERE interval_id = '6ccc5fba-b0ae-4e86-b158-4c0dff810197';
INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('6ccc5fba-b0ae-4e86-b158-4c0dff810197', 'Cambiar aceite completo ejes reducción cubo AC16. 22 + 20 L, Sintético SAE 75W90, M342 S1/S2', 'Reemplazo'),
('6ccc5fba-b0ae-4e86-b158-4c0dff810197', 'Revisar y calibrar carrera servo embrague. Rango 27-30mm', 'Calibración');

-- LONG CHASIS: same as AUTOMATICO
DELETE FROM maintenance_tasks WHERE interval_id = 'd7791464-f579-4d2b-a7d2-89e4c067e3ec';
INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('d7791464-f579-4d2b-a7d2-89e4c067e3ec', 'Cambiar aceite completo ejes reducción cubo AC16. 22 + 20 L, Sintético SAE 75W90, M342 S1/S2', 'Reemplazo'),
('d7791464-f579-4d2b-a7d2-89e4c067e3ec', 'Revisar y calibrar carrera servo embrague. Rango 27-30mm', 'Calibración');

-- ========== 300h INTERVAL ==========
-- Shared tasks + MANUAL: HW25; AUTO/LONG: ZF
DELETE FROM maintenance_tasks WHERE interval_id IN ('504e757a-61fe-4153-8828-f73846b34fca', '5bd2c3c8-375c-4c83-bf0b-14136aef74ba', '46044069-4d32-4c58-9bf3-e64546432d57');

-- MANUAL 300h
INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('504e757a-61fe-4153-8828-f73846b34fca', 'Revisar nivel aceite motor y rellenar. 42 L, Sintético SAE 10W40, M3277/M3477', 'Inspección'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Cambiar filtro aire primario (exterior). No sopletear, verificar vacuómetro', 'Reemplazo'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Limpiar radiadores con aire y agua a presión. 50 cm distancia, no dañar paneles', 'Limpieza'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Calibrar carrera vástago servo embrague. 27-30mm, alto riesgo si <23mm', 'Calibración'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Revisar recorrido chicotes palanca cambios y ajustar. Verificar enrutado cables', 'Inspección'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Revisar nivel aceite transmisión HW25. 15 L, SAE 75W90', 'Inspección'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Revisar nivel aceite reductor ZF mixer. 17.5 L, SAE 75W90', 'Inspección'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Revisar y calibrar alineación y balanceo. Verificar rótulas y altura', 'Calibración'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Revisar terminales esféricas eje delantero. Juego radial máx 0.25mm', 'Inspección'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Engrasar todos los puntos de lubricación. 0.5 kg NLGI-2, crucetas, dirección', 'Lubricación'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Revisar tensor y poleas correa motor. Verificar grietas', 'Inspección'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Revisar y rellenar lubricación cubos. 0.625 kg/lado NLGI-3', 'Inspección'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Engrasar crucetas cardán mixer. 0.2 kg NLGI-2', 'Lubricación'),
('504e757a-61fe-4153-8828-f73846b34fca', 'Revisar tambores frenos y ajuste. Holgura 0.8-1.0mm, lubricar vástago', 'Inspección');

-- AUTOMATICO 300h
INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Revisar nivel aceite motor y rellenar. 42 L, Sintético SAE 10W40, M3277/M3477', 'Inspección'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Cambiar filtro aire primario (exterior). No sopletear, verificar vacuómetro', 'Reemplazo'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Limpiar radiadores con aire y agua a presión. 50 cm distancia, no dañar paneles', 'Limpieza'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Calibrar carrera vástago servo embrague. 27-30mm, alto riesgo si <23mm', 'Calibración'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Revisar recorrido chicotes palanca cambios y ajustar. Verificar enrutado cables', 'Inspección'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Revisar nivel aceite transmisión ZF. 25 L, SAE 75W80', 'Inspección'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Revisar nivel aceite reductor ZF mixer. 17.5 L, SAE 75W90', 'Inspección'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Revisar y calibrar alineación y balanceo. Verificar rótulas y altura', 'Calibración'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Revisar terminales esféricas eje delantero. Juego radial máx 0.25mm', 'Inspección'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Engrasar todos los puntos de lubricación. 0.5 kg NLGI-2, crucetas, dirección', 'Lubricación'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Revisar tensor y poleas correa motor. Verificar grietas', 'Inspección'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Revisar y rellenar lubricación cubos. 0.625 kg/lado NLGI-3', 'Inspección'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Engrasar crucetas cardán mixer. 0.2 kg NLGI-2', 'Lubricación'),
('5bd2c3c8-375c-4c83-bf0b-14136aef74ba', 'Revisar tambores frenos y ajuste. Holgura 0.8-1.0mm, lubricar vástago', 'Inspección');

-- LONG CHASIS 300h (same as AUTOMATICO)
INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('46044069-4d32-4c58-9bf3-e64546432d57', 'Revisar nivel aceite motor y rellenar. 42 L, Sintético SAE 10W40, M3277/M3477', 'Inspección'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Cambiar filtro aire primario (exterior). No sopletear, verificar vacuómetro', 'Reemplazo'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Limpiar radiadores con aire y agua a presión. 50 cm distancia, no dañar paneles', 'Limpieza'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Calibrar carrera vástago servo embrague. 27-30mm, alto riesgo si <23mm', 'Calibración'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Revisar recorrido chicotes palanca cambios y ajustar. Verificar enrutado cables', 'Inspección'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Revisar nivel aceite transmisión ZF. 25 L, SAE 75W80', 'Inspección'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Revisar nivel aceite reductor ZF mixer. 17.5 L, SAE 75W90', 'Inspección'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Revisar y calibrar alineación y balanceo. Verificar rótulas y altura', 'Calibración'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Revisar terminales esféricas eje delantero. Juego radial máx 0.25mm', 'Inspección'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Engrasar todos los puntos de lubricación. 0.5 kg NLGI-2, crucetas, dirección', 'Lubricación'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Revisar tensor y poleas correa motor. Verificar grietas', 'Inspección'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Revisar y rellenar lubricación cubos. 0.625 kg/lado NLGI-3', 'Inspección'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Engrasar crucetas cardán mixer. 0.2 kg NLGI-2', 'Lubricación'),
('46044069-4d32-4c58-9bf3-e64546432d57', 'Revisar tambores frenos y ajuste. Holgura 0.8-1.0mm, lubricar vástago', 'Inspección');

-- ========== 600h INTERVAL ==========
DELETE FROM maintenance_tasks WHERE interval_id IN ('a9f44c76-10ab-4933-b3fa-262e204e46b9', '498f048e-e0c1-43b4-a29c-0af777b05f69', 'ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Revisar nivel aceite motor. 42 L', 'Inspección'),
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Cambiar filtro aire secundario (interior). Verificar vacuómetro electrónico', 'Reemplazo'),
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Cambiar filtro principal combustible y separador. Filtro KSC + separador agua', 'Reemplazo'),
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Revisar sistema SCR, cambiar si necesario. Lavar cristalizaciones UREA', 'Inspección'),
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Limpiar radiadores completo. Sopletear y agua presión', 'Limpieza'),
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Revisar estado correa motor. Verificar tensor cada 300 hr', 'Inspección'),
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Revisar y ajustar chicotes cambios', 'Inspección'),
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Revisar nivel transmisión HW25. 15 L', 'Inspección'),
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Revisar nivel reductor ZF mixer. 17.5 L', 'Inspección'),
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Revisar y calibrar alineación y balanceo', 'Calibración'),
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Revisar terminales esféricas eje delantero', 'Inspección'),
('a9f44c76-10ab-4933-b3fa-262e204e46b9', 'Revisar estado lubricación cubos', 'Inspección');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Revisar nivel aceite motor. 42 L', 'Inspección'),
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Cambiar filtro aire secundario (interior). Verificar vacuómetro electrónico', 'Reemplazo'),
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Cambiar filtro principal combustible y separador. Filtro KSC + separador agua', 'Reemplazo'),
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Revisar sistema SCR, cambiar si necesario. Lavar cristalizaciones UREA', 'Inspección'),
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Limpiar radiadores completo. Sopletear y agua presión', 'Limpieza'),
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Revisar estado correa motor. Verificar tensor cada 300 hr', 'Inspección'),
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Revisar y ajustar chicotes cambios', 'Inspección'),
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Revisar nivel reductor ZF mixer. 17.5 L', 'Inspección'),
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Revisar y calibrar alineación y balanceo', 'Calibración'),
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Revisar terminales esféricas eje delantero', 'Inspección'),
('498f048e-e0c1-43b4-a29c-0af777b05f69', 'Revisar estado lubricación cubos', 'Inspección');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Revisar nivel aceite motor. 42 L', 'Inspección'),
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Cambiar filtro aire secundario (interior). Verificar vacuómetro electrónico', 'Reemplazo'),
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Cambiar filtro principal combustible y separador. Filtro KSC + separador agua', 'Reemplazo'),
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Revisar sistema SCR, cambiar si necesario. Lavar cristalizaciones UREA', 'Inspección'),
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Limpiar radiadores completo. Sopletear y agua presión', 'Limpieza'),
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Revisar estado correa motor. Verificar tensor cada 300 hr', 'Inspección'),
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Revisar y ajustar chicotes cambios', 'Inspección'),
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Revisar nivel reductor ZF mixer. 17.5 L', 'Inspección'),
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Revisar y calibrar alineación y balanceo', 'Calibración'),
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Revisar terminales esféricas eje delantero', 'Inspección'),
('ba3aeaaa-f5c8-4b98-8c2c-20fd26f0dc93', 'Revisar estado lubricación cubos', 'Inspección');

-- ========== 900h INTERVAL ==========
DELETE FROM maintenance_tasks WHERE interval_id IN ('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'c2c9d0cd-86cf-464f-ae98-d6908880d0e6');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'Cambiar aceite y filtro motor completo. 42 L, Sintético SAE 10W40, M3277/M3477', 'Reemplazo'),
('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'Cambiar filtro aire primario (exterior). No sopletear', 'Reemplazo'),
('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'Revisar filtros combustible. Cambio cada 600 hr', 'Inspección'),
('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'Cambiar filtro principal sistema SCR. Lavar cristalizaciones con agua caliente', 'Reemplazo'),
('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'Limpiar radiadores', 'Limpieza'),
('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'Revisar estado correa motor', 'Inspección'),
('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'Revisar nivel refrigerante. 55 L, MAN-324 type SNF', 'Inspección'),
('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'Revisar nivel fluido embrague. 0.5 L DOT 4', 'Inspección'),
('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'Revisar nivel transmisión HW25. 15 L', 'Inspección'),
('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'Cambiar aceite reductor ZF mixer. 17.5 L, SAE 75W90', 'Reemplazo'),
('9197cb8c-b7d5-46b0-b6dd-4ecf69753137', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'Cambiar aceite y filtro motor completo. 42 L, Sintético SAE 10W40, M3277/M3477', 'Reemplazo'),
('fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'Cambiar filtro aire primario (exterior). No sopletear', 'Reemplazo'),
('fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'Revisar filtros combustible. Cambio cada 600 hr', 'Inspección'),
('fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'Cambiar filtro principal sistema SCR. Lavar cristalizaciones con agua caliente', 'Reemplazo'),
('fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'Limpiar radiadores', 'Limpieza'),
('fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'Revisar estado correa motor', 'Inspección'),
('fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'Revisar nivel refrigerante. 55 L, MAN-324 type SNF', 'Inspección'),
('fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'Revisar nivel fluido embrague. 0.5 L DOT 4', 'Inspección'),
('fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'Cambiar aceite reductor ZF mixer. 17.5 L, SAE 75W90', 'Reemplazo'),
('fd039c9d-bbd0-4f87-8df7-2eb09be5ec07', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('c2c9d0cd-86cf-464f-ae98-d6908880d0e6', 'Cambiar aceite y filtro motor completo. 42 L, Sintético SAE 10W40, M3277/M3477', 'Reemplazo'),
('c2c9d0cd-86cf-464f-ae98-d6908880d0e6', 'Cambiar filtro aire primario (exterior). No sopletear', 'Reemplazo'),
('c2c9d0cd-86cf-464f-ae98-d6908880d0e6', 'Revisar filtros combustible. Cambio cada 600 hr', 'Inspección'),
('c2c9d0cd-86cf-464f-ae98-d6908880d0e6', 'Cambiar filtro principal sistema SCR. Lavar cristalizaciones con agua caliente', 'Reemplazo'),
('c2c9d0cd-86cf-464f-ae98-d6908880d0e6', 'Limpiar radiadores', 'Limpieza'),
('c2c9d0cd-86cf-464f-ae98-d6908880d0e6', 'Revisar estado correa motor', 'Inspección'),
('c2c9d0cd-86cf-464f-ae98-d6908880d0e6', 'Revisar nivel refrigerante. 55 L, MAN-324 type SNF', 'Inspección'),
('c2c9d0cd-86cf-464f-ae98-d6908880d0e6', 'Revisar nivel fluido embrague. 0.5 L DOT 4', 'Inspección'),
('c2c9d0cd-86cf-464f-ae98-d6908880d0e6', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('c2c9d0cd-86cf-464f-ae98-d6908880d0e6', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('c2c9d0cd-86cf-464f-ae98-d6908880d0e6', 'Cambiar aceite reductor ZF mixer. 17.5 L, SAE 75W90', 'Reemplazo'),
('c2c9d0cd-86cf-464f-ae98-d6908880d0e6', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

-- ========== 1200h INTERVAL ==========
DELETE FROM maintenance_tasks WHERE interval_id IN ('2c27e8ea-a84c-431d-9578-06e92c65b8cd', '30176f28-5750-4872-b9a6-9c035ad498b5', '51324b0a-a401-4632-93b5-806e2ea78ac3');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Revisar nivel aceite motor. 42 L', 'Inspección'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Cambiar filtro aire secundario (interior)', 'Reemplazo'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Cambiar filtros combustible completos. KSC + separador', 'Reemplazo'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Revisar sistema SCR y cambiar si necesario', 'Inspección'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Limpiar radiadores', 'Limpieza'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Revisar estado correa motor', 'Inspección'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Revisar nivel refrigerante. 55 L', 'Inspección'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Revisar nivel transmisión HW25. 15 L', 'Inspección'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Cambiar filtro antipolen A/C cabina. Limpiar carcaza interior', 'Reemplazo'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Revisar y limpiar baterías. Limpiador dieléctrico, rotar baterías', 'Limpieza'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Revisar y limpiar sistema eléctrico botonera mixer. Dynachute y potenciómetro', 'Inspección'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Revisar apriete tornillería chasis. Aplicar Loctite 277 y torquímetro', 'Inspección'),
('2c27e8ea-a84c-431d-9578-06e92c65b8cd', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Revisar nivel aceite motor. 42 L', 'Inspección'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Cambiar filtro aire secundario (interior)', 'Reemplazo'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Cambiar filtros combustible completos. KSC + separador', 'Reemplazo'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Revisar sistema SCR y cambiar si necesario', 'Inspección'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Limpiar radiadores', 'Limpieza'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Revisar estado correa motor', 'Inspección'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Revisar nivel refrigerante. 55 L', 'Inspección'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Cambiar filtro antipolen A/C cabina. Limpiar carcaza interior', 'Reemplazo'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Revisar y limpiar baterías. Limpiador dieléctrico, rotar baterías', 'Limpieza'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Revisar y limpiar sistema eléctrico botonera mixer. Dynachute y potenciómetro', 'Inspección'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Revisar apriete tornillería chasis. Aplicar Loctite 277 y torquímetro', 'Inspección'),
('30176f28-5750-4872-b9a6-9c035ad498b5', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Revisar nivel aceite motor. 42 L', 'Inspección'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Cambiar filtro aire secundario (interior)', 'Reemplazo'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Cambiar filtros combustible completos. KSC + separador', 'Reemplazo'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Revisar sistema SCR y cambiar si necesario', 'Inspección'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Limpiar radiadores', 'Limpieza'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Revisar estado correa motor', 'Inspección'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Revisar nivel refrigerante. 55 L', 'Inspección'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Cambiar filtro antipolen A/C cabina. Limpiar carcaza interior', 'Reemplazo'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Revisar y limpiar baterías. Limpiador dieléctrico, rotar baterías', 'Limpieza'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Revisar y limpiar sistema eléctrico botonera mixer. Dynachute y potenciómetro', 'Inspección'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Revisar apriete tornillería chasis. Aplicar Loctite 277 y torquímetro', 'Inspección'),
('51324b0a-a401-4632-93b5-806e2ea78ac3', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

-- ========== 1500h, 2100h, 3000h, 3300h (ESTÁNDAR - shared) ==========
-- 1500h
DELETE FROM maintenance_tasks WHERE interval_id IN ('babc0d5c-1439-4655-9fab-41b75de1750f', '9d49ebb0-8785-4af0-9df5-3c2591307ce4', 'fbcfb710-6c8f-496a-b1d0-a64853f9d363');
INSERT INTO maintenance_tasks (interval_id, description, type)
SELECT mi.id, t.descr, t.typ FROM maintenance_intervals mi CROSS JOIN (VALUES
  ('Revisar nivel aceite motor. 42 L', 'Inspección'),
  ('Revisar filtros combustible', 'Inspección'),
  ('Revisar sistema SCR', 'Inspección'),
  ('Limpiar radiadores', 'Limpieza'),
  ('Revisar estado correa motor', 'Inspección'),
  ('Revisar nivel refrigerante. 55 L', 'Inspección'),
  ('Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
  ('Calibrar servo embrague. 27-30mm', 'Calibración'),
  ('Engrasar lubricación general. 0.5 kg', 'Lubricación')
) AS t(descr, typ)
WHERE mi.id IN ('babc0d5c-1439-4655-9fab-41b75de1750f', '9d49ebb0-8785-4af0-9df5-3c2591307ce4', 'fbcfb710-6c8f-496a-b1d0-a64853f9d363');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('babc0d5c-1439-4655-9fab-41b75de1750f', 'Revisar nivel transmisión HW25. 15 L', 'Inspección'),
('9d49ebb0-8785-4af0-9df5-3c2591307ce4', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('fbcfb710-6c8f-496a-b1d0-a64853f9d363', 'Revisar nivel transmisión ZF. 25 L', 'Inspección');

-- ========== 1800h INTERVAL (MAYOR COMPLETO - transmission specific) ==========
DELETE FROM maintenance_tasks WHERE interval_id IN ('9a70a424-e705-49c4-a825-e6c9c66acc75', 'ad110823-588d-45ed-a948-79b1a2c100f6', '7941ed67-67cf-44bb-9d23-8661ed195097');

-- MANUAL 1800h: HW25 cambiar
INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Revisar nivel aceite motor. 42 L (cambio cada 900 hr)', 'Inspección'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Calibrar válvulas culata motor. Admisión 0.50mm, Escape 0.80mm, EVB 0.60mm', 'Calibración'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Cambiar filtro aire primario (exterior)', 'Reemplazo'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Cambiar filtros combustible completos. KSC + separador', 'Reemplazo'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Cambiar filtro principal sistema SCR. Lavar cristalizaciones', 'Reemplazo'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Cambiar correa motor completa. Vida máxima alcanzada', 'Reemplazo'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Limpiar radiadores completo', 'Limpieza'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Revisar nivel refrigerante. 55 L (cambio 3,600 hr)', 'Inspección'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Cambiar fluido embrague completo. 0.5 L DOT 4, M-3289', 'Reemplazo'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Revisar y ajustar chicotes cambios', 'Inspección'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Cambiar aceite y filtro transmisión HW25. 15 L, SAE 75W90, M-342 S1/S2', 'Reemplazo'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Cambiar aceite y filtro dirección 6x4. 2 L, ATF DEXRON III, M-339', 'Reemplazo'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Revisar y calibrar alineación y balanceo', 'Calibración'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Revisar terminales esféricas eje delantero', 'Inspección'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Revisar estado lubricación cubos', 'Inspección'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Engrasar lubricación general. 0.5 kg', 'Lubricación'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Cambiar aceite y filtro bomba EATON mixer. 16 L, BT26/H68 - ISO VG68', 'Reemplazo'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Cambiar aceite Dynachute mixer. 4 L, BT26/H68 - ISO VG68', 'Reemplazo'),
('9a70a424-e705-49c4-a825-e6c9c66acc75', 'Cambiar cartucho secador sistema neumático. Cartucho WABCO', 'Reemplazo');

-- AUTOMATICO 1800h: ZF cambiar
INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Revisar nivel aceite motor. 42 L (cambio cada 900 hr)', 'Inspección'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Calibrar válvulas culata motor. Admisión 0.50mm, Escape 0.80mm, EVB 0.60mm', 'Calibración'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Cambiar filtro aire primario (exterior)', 'Reemplazo'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Cambiar filtros combustible completos. KSC + separador', 'Reemplazo'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Cambiar filtro principal sistema SCR. Lavar cristalizaciones', 'Reemplazo'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Cambiar correa motor completa. Vida máxima alcanzada', 'Reemplazo'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Limpiar radiadores completo', 'Limpieza'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Revisar nivel refrigerante. 55 L (cambio 3,600 hr)', 'Inspección'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Cambiar fluido embrague completo. 0.5 L DOT 4, M-3289', 'Reemplazo'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Revisar y ajustar chicotes cambios', 'Inspección'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Cambiar aceite y filtro Intarder transmisión ZF. 25 L, SAE 75W80, M-341-Z4', 'Reemplazo'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Cambiar aceite y filtro dirección 6x4. 2 L, ATF DEXRON III, M-339', 'Reemplazo'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Revisar y calibrar alineación y balanceo', 'Calibración'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Revisar terminales esféricas eje delantero', 'Inspección'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Revisar estado lubricación cubos', 'Inspección'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Engrasar lubricación general. 0.5 kg', 'Lubricación'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Cambiar aceite y filtro bomba EATON mixer. 16 L, BT26/H68 - ISO VG68', 'Reemplazo'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Cambiar aceite Dynachute mixer. 4 L, BT26/H68 - ISO VG68', 'Reemplazo'),
('ad110823-588d-45ed-a948-79b1a2c100f6', 'Cambiar cartucho secador sistema neumático. Cartucho WABCO', 'Reemplazo');

-- LONG CHASIS 1800h (same as AUTOMATICO)
INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Revisar nivel aceite motor. 42 L (cambio cada 900 hr)', 'Inspección'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Calibrar válvulas culata motor. Admisión 0.50mm, Escape 0.80mm, EVB 0.60mm', 'Calibración'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Cambiar filtro aire primario (exterior)', 'Reemplazo'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Cambiar filtros combustible completos. KSC + separador', 'Reemplazo'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Cambiar filtro principal sistema SCR. Lavar cristalizaciones', 'Reemplazo'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Cambiar correa motor completa. Vida máxima alcanzada', 'Reemplazo'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Limpiar radiadores completo', 'Limpieza'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Revisar nivel refrigerante. 55 L (cambio 3,600 hr)', 'Inspección'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Cambiar fluido embrague completo. 0.5 L DOT 4, M-3289', 'Reemplazo'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Revisar y ajustar chicotes cambios', 'Inspección'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Cambiar aceite y filtro Intarder transmisión ZF. 25 L, SAE 75W80, M-341-Z4', 'Reemplazo'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Cambiar aceite y filtro dirección 6x4. 2 L, ATF DEXRON III, M-339', 'Reemplazo'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Revisar y calibrar alineación y balanceo', 'Calibración'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Revisar terminales esféricas eje delantero', 'Inspección'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Revisar estado lubricación cubos', 'Inspección'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Engrasar lubricación general. 0.5 kg', 'Lubricación'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Cambiar aceite y filtro bomba EATON mixer. 16 L, BT26/H68 - ISO VG68', 'Reemplazo'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Cambiar aceite Dynachute mixer. 4 L, BT26/H68 - ISO VG68', 'Reemplazo'),
('7941ed67-67cf-44bb-9d23-8661ed195097', 'Cambiar cartucho secador sistema neumático. Cartucho WABCO', 'Reemplazo');

-- ========== 2100h INTERVAL (MANUAL no Bomba/Dynachute; AUTO/LONG have them) ==========
DELETE FROM maintenance_tasks WHERE interval_id IN ('5d096ea4-600f-43d1-9057-53d999c01eb6', 'fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'd3427471-189f-4ca6-aa76-626ea2a56c95');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('5d096ea4-600f-43d1-9057-53d999c01eb6', 'Revisar nivel aceite motor. 42 L', 'Inspección'),
('5d096ea4-600f-43d1-9057-53d999c01eb6', 'Revisar filtros combustible', 'Inspección'),
('5d096ea4-600f-43d1-9057-53d999c01eb6', 'Revisar sistema SCR', 'Inspección'),
('5d096ea4-600f-43d1-9057-53d999c01eb6', 'Limpiar radiadores', 'Limpieza'),
('5d096ea4-600f-43d1-9057-53d999c01eb6', 'Revisar estado correa motor', 'Inspección'),
('5d096ea4-600f-43d1-9057-53d999c01eb6', 'Revisar nivel refrigerante. 55 L', 'Inspección'),
('5d096ea4-600f-43d1-9057-53d999c01eb6', 'Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
('5d096ea4-600f-43d1-9057-53d999c01eb6', 'Calibrar servo embrague. 27-30mm', 'Calibración'),
('5d096ea4-600f-43d1-9057-53d999c01eb6', 'Revisar nivel transmisión HW25. 15 L', 'Inspección'),
('5d096ea4-600f-43d1-9057-53d999c01eb6', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'Revisar nivel aceite motor. 42 L', 'Inspección'),
('fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'Revisar filtros combustible', 'Inspección'),
('fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'Revisar sistema SCR', 'Inspección'),
('fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'Limpiar radiadores', 'Limpieza'),
('fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'Revisar estado correa motor', 'Inspección'),
('fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'Revisar nivel refrigerante. 55 L', 'Inspección'),
('fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
('fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'Calibrar servo embrague. 27-30mm', 'Calibración'),
('fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'Revisar nivel bomba EATON. 16 L', 'Inspección'),
('fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'Revisar nivel Dynachute. 4 L', 'Inspección'),
('fe8b0ec5-8c20-4596-acd9-e18f1d6b78c3', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('d3427471-189f-4ca6-aa76-626ea2a56c95', 'Revisar nivel aceite motor. 42 L', 'Inspección'),
('d3427471-189f-4ca6-aa76-626ea2a56c95', 'Revisar filtros combustible', 'Inspección'),
('d3427471-189f-4ca6-aa76-626ea2a56c95', 'Revisar sistema SCR', 'Inspección'),
('d3427471-189f-4ca6-aa76-626ea2a56c95', 'Limpiar radiadores', 'Limpieza'),
('d3427471-189f-4ca6-aa76-626ea2a56c95', 'Revisar estado correa motor', 'Inspección'),
('d3427471-189f-4ca6-aa76-626ea2a56c95', 'Revisar nivel refrigerante. 55 L', 'Inspección'),
('d3427471-189f-4ca6-aa76-626ea2a56c95', 'Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
('d3427471-189f-4ca6-aa76-626ea2a56c95', 'Calibrar servo embrague. 27-30mm', 'Calibración'),
('d3427471-189f-4ca6-aa76-626ea2a56c95', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('d3427471-189f-4ca6-aa76-626ea2a56c95', 'Revisar nivel bomba EATON. 16 L', 'Inspección'),
('d3427471-189f-4ca6-aa76-626ea2a56c95', 'Revisar nivel Dynachute. 4 L', 'Inspección'),
('d3427471-189f-4ca6-aa76-626ea2a56c95', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

-- ========== 2400h INTERVAL (same structure as 1200h) ==========
DELETE FROM maintenance_tasks WHERE interval_id IN ('e86e6cdb-0c05-4e40-bfe4-6899847385cf', '97a93767-b4ca-45e2-85b6-040309c11752', '8bcb9e22-cca1-4573-86e7-ab74369c963d');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Revisar nivel aceite motor. 42 L', 'Inspección'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Cambiar filtro aire secundario (interior)', 'Reemplazo'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Cambiar filtros combustible completos', 'Reemplazo'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Revisar sistema SCR y cambiar si necesario', 'Inspección'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Limpiar radiadores', 'Limpieza'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Revisar estado correa motor', 'Inspección'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Revisar nivel refrigerante. 55 L', 'Inspección'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Calibrar servo embrague. 27-30mm', 'Calibración'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Cambiar filtro antipolen A/C', 'Reemplazo'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Revisar y limpiar sistema eléctrico completo', 'Limpieza'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Revisar sistema eléctrico botonera mixer', 'Inspección'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Revisar apriete tornillería', 'Inspección'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Revisar nivel transmisión HW25. 15 L', 'Inspección'),
('e86e6cdb-0c05-4e40-bfe4-6899847385cf', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('97a93767-b4ca-45e2-85b6-040309c11752', 'Revisar nivel aceite motor. 42 L', 'Inspección'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Cambiar filtro aire secundario (interior)', 'Reemplazo'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Cambiar filtros combustible completos', 'Reemplazo'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Revisar sistema SCR y cambiar si necesario', 'Inspección'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Limpiar radiadores', 'Limpieza'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Revisar estado correa motor', 'Inspección'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Revisar nivel refrigerante. 55 L', 'Inspección'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Calibrar servo embrague. 27-30mm', 'Calibración'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Cambiar filtro antipolen A/C', 'Reemplazo'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Revisar y limpiar sistema eléctrico completo', 'Limpieza'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Revisar sistema eléctrico botonera mixer', 'Inspección'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Revisar apriete tornillería', 'Inspección'),
('97a93767-b4ca-45e2-85b6-040309c11752', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Revisar nivel aceite motor. 42 L', 'Inspección'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Cambiar filtro aire secundario (interior)', 'Reemplazo'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Cambiar filtros combustible completos', 'Reemplazo'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Revisar sistema SCR y cambiar si necesario', 'Inspección'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Limpiar radiadores', 'Limpieza'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Revisar estado correa motor', 'Inspección'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Revisar nivel refrigerante. 55 L', 'Inspección'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Calibrar servo embrague. 27-30mm', 'Calibración'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Cambiar filtro antipolen A/C', 'Reemplazo'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Revisar y limpiar sistema eléctrico completo', 'Limpieza'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Revisar sistema eléctrico botonera mixer', 'Inspección'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Revisar apriete tornillería', 'Inspección'),
('8bcb9e22-cca1-4573-86e7-ab74369c963d', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

-- ========== 2700h (MAYOR MOTOR) ==========
DELETE FROM maintenance_tasks WHERE interval_id IN ('9a3028ca-066c-4043-9afa-2fa2dd536172', 'c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'a6738141-22be-489f-ab3f-23a0e2e9094d');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('9a3028ca-066c-4043-9afa-2fa2dd536172', 'Cambiar aceite y filtro motor. 42 L, SAE 10W40', 'Reemplazo'),
('9a3028ca-066c-4043-9afa-2fa2dd536172', 'Cambiar filtro aire primario (exterior)', 'Reemplazo'),
('9a3028ca-066c-4043-9afa-2fa2dd536172', 'Revisar filtros combustible', 'Inspección'),
('9a3028ca-066c-4043-9afa-2fa2dd536172', 'Cambiar filtro sistema SCR', 'Reemplazo'),
('9a3028ca-066c-4043-9afa-2fa2dd536172', 'Limpiar radiadores', 'Limpieza'),
('9a3028ca-066c-4043-9afa-2fa2dd536172', 'Revisar estado correa motor', 'Inspección'),
('9a3028ca-066c-4043-9afa-2fa2dd536172', 'Revisar nivel refrigerante. 55 L', 'Inspección'),
('9a3028ca-066c-4043-9afa-2fa2dd536172', 'Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
('9a3028ca-066c-4043-9afa-2fa2dd536172', 'Calibrar servo embrague. 27-30mm', 'Calibración'),
('9a3028ca-066c-4043-9afa-2fa2dd536172', 'Revisar nivel transmisión HW25. 15 L', 'Inspección'),
('9a3028ca-066c-4043-9afa-2fa2dd536172', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'Cambiar aceite y filtro motor. 42 L, SAE 10W40', 'Reemplazo'),
('c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'Cambiar filtro aire primario (exterior)', 'Reemplazo'),
('c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'Revisar filtros combustible', 'Inspección'),
('c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'Cambiar filtro sistema SCR', 'Reemplazo'),
('c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'Limpiar radiadores', 'Limpieza'),
('c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'Revisar estado correa motor', 'Inspección'),
('c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'Revisar nivel refrigerante. 55 L', 'Inspección'),
('c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
('c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'Calibrar servo embrague. 27-30mm', 'Calibración'),
('c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('c0e0fa16-b5f6-4156-bbba-b31d03aed92e', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('a6738141-22be-489f-ab3f-23a0e2e9094d', 'Cambiar aceite y filtro motor. 42 L, SAE 10W40', 'Reemplazo'),
('a6738141-22be-489f-ab3f-23a0e2e9094d', 'Cambiar filtro aire primario (exterior)', 'Reemplazo'),
('a6738141-22be-489f-ab3f-23a0e2e9094d', 'Revisar filtros combustible', 'Inspección'),
('a6738141-22be-489f-ab3f-23a0e2e9094d', 'Cambiar filtro sistema SCR', 'Reemplazo'),
('a6738141-22be-489f-ab3f-23a0e2e9094d', 'Limpiar radiadores', 'Limpieza'),
('a6738141-22be-489f-ab3f-23a0e2e9094d', 'Revisar estado correa motor', 'Inspección'),
('a6738141-22be-489f-ab3f-23a0e2e9094d', 'Revisar nivel refrigerante. 55 L', 'Inspección'),
('a6738141-22be-489f-ab3f-23a0e2e9094d', 'Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
('a6738141-22be-489f-ab3f-23a0e2e9094d', 'Calibrar servo embrague. 27-30mm', 'Calibración'),
('a6738141-22be-489f-ab3f-23a0e2e9094d', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('a6738141-22be-489f-ab3f-23a0e2e9094d', 'Engrasar lubricación general. 0.5 kg', 'Lubricación');

-- ========== 3000h, 3300h (ESTÁNDAR) ==========
DELETE FROM maintenance_tasks WHERE interval_id IN ('ecf6af53-e096-4717-89d9-6e745f66c278', 'ac49a790-4483-4dd1-ad84-6baf84ce03fc', 'd0dfb632-03de-4386-83cb-cf918d08dcad', '703fdd30-494c-4605-9294-2bffa20c1a83', 'c1ef26cc-4c76-4c3c-aeb4-6df1b75182c4', '81d81dc3-21b6-4dd2-95dc-23f8ad3a88c4');

INSERT INTO maintenance_tasks (interval_id, description, type)
SELECT mi.id, t.descr, t.typ FROM maintenance_intervals mi CROSS JOIN (VALUES
  ('Revisar nivel aceite motor. 42 L', 'Inspección'),
  ('Revisar filtros combustible', 'Inspección'),
  ('Revisar sistema SCR', 'Inspección'),
  ('Limpiar radiadores', 'Limpieza'),
  ('Revisar estado correa motor', 'Inspección'),
  ('Revisar nivel refrigerante. 55 L', 'Inspección'),
  ('Revisar nivel fluido embrague. 0.5 L', 'Inspección'),
  ('Calibrar servo embrague. 27-30mm', 'Calibración'),
  ('Engrasar lubricación general. 0.5 kg', 'Lubricación')
) AS t(descr, typ)
WHERE mi.id IN ('ecf6af53-e096-4717-89d9-6e745f66c278', 'ac49a790-4483-4dd1-ad84-6baf84ce03fc', 'd0dfb632-03de-4386-83cb-cf918d08dcad', '703fdd30-494c-4605-9294-2bffa20c1a83', 'c1ef26cc-4c76-4c3c-aeb4-6df1b75182c4', '81d81dc3-21b6-4dd2-95dc-23f8ad3a88c4');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('ecf6af53-e096-4717-89d9-6e745f66c278', 'Revisar nivel transmisión HW25. 15 L', 'Inspección'),
('ac49a790-4483-4dd1-ad84-6baf84ce03fc', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('d0dfb632-03de-4386-83cb-cf918d08dcad', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('703fdd30-494c-4605-9294-2bffa20c1a83', 'Revisar nivel transmisión HW25. 15 L', 'Inspección'),
('c1ef26cc-4c76-4c3c-aeb4-6df1b75182c4', 'Revisar nivel transmisión ZF. 25 L', 'Inspección'),
('81d81dc3-21b6-4dd2-95dc-23f8ad3a88c4', 'Revisar nivel transmisión ZF. 25 L', 'Inspección');

-- ========== 3600h (ULTRA COMPLETO) ==========
DELETE FROM maintenance_tasks WHERE interval_id IN ('f37916a3-bac0-43ba-ae1c-3dea38126ee8', '204c76db-b192-4f1b-9de0-aaa2aaf71d31', '73438431-dd6c-4f26-ae0a-9f1d53a8954b');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Cambiar aceite y filtro motor. 42 L, SAE 10W40', 'Reemplazo'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Calibrar válvulas culata si es necesario. Admisión 0.50mm, Escape 0.80mm', 'Calibración'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Cambiar filtro aire primario (exterior)', 'Reemplazo'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Cambiar filtro aire secundario (interior)', 'Reemplazo'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Cambiar filtros combustible completos', 'Reemplazo'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Cambiar filtro sistema SCR', 'Reemplazo'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Cambiar correa motor si es necesario. Revisar tensor', 'Reemplazo'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Cambiar refrigerante completo. 55 L, MAN-324 type SNF, -37°C', 'Reemplazo'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Limpiar radiadores completo', 'Limpieza'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Revisar nivel fluido embrague. 0.5 L (cambio 1,800 hr)', 'Inspección'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Revisar nivel transmisión HW25. 15 L (cambio 1,800 hr)', 'Inspección'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Revisar nivel dirección. 2 L (cambio 1,800 hr)', 'Inspección'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Cambiar grasa completa lubricación cubos. 1.3 kg, tuercas, chavetas, reténes', 'Reemplazo'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Cambiar aceite eje equilibrio 6x4. 2 L, SAE 75W90', 'Reemplazo'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Cambiar gas A/C cabina completo. 0.7 kg, R134a, usar recuperador', 'Reemplazo'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Cambiar filtro antipolen A/C', 'Reemplazo'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Revisar y limpiar sistema eléctrico completo', 'Limpieza'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Revisar sistema completo botonera mixer', 'Inspección'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Revisar apriete tornillería completo. Loctite 277', 'Inspección'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Engrasar pista mezclador completo. 2 kg hasta cubrir circunferencia', 'Lubricación'),
('f37916a3-bac0-43ba-ae1c-3dea38126ee8', 'Engrasar todos los puntos mixer. 2 kg NLGI-2', 'Lubricación');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Cambiar aceite y filtro motor. 42 L, SAE 10W40', 'Reemplazo'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Calibrar válvulas culata si es necesario. Admisión 0.50mm, Escape 0.80mm', 'Calibración'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Cambiar filtro aire primario (exterior)', 'Reemplazo'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Cambiar filtro aire secundario (interior)', 'Reemplazo'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Cambiar filtros combustible completos', 'Reemplazo'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Cambiar filtro sistema SCR', 'Reemplazo'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Cambiar correa motor si es necesario. Revisar tensor', 'Reemplazo'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Cambiar refrigerante completo. 55 L, MAN-324 type SNF, -37°C', 'Reemplazo'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Limpiar radiadores completo', 'Limpieza'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Revisar nivel fluido embrague. 0.5 L (cambio 1,800 hr)', 'Inspección'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Revisar nivel transmisión ZF. 25 L (cambio 1,800 hr)', 'Inspección'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Revisar nivel dirección. 2 L (cambio 1,800 hr)', 'Inspección'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Cambiar grasa completa lubricación cubos. 1.3 kg, tuercas, chavetas, reténes', 'Reemplazo'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Cambiar aceite eje equilibrio 6x4. 2 L, SAE 75W90', 'Reemplazo'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Cambiar gas A/C cabina completo. 0.7 kg, R134a, usar recuperador', 'Reemplazo'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Cambiar filtro antipolen A/C', 'Reemplazo'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Revisar y limpiar sistema eléctrico completo', 'Limpieza'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Revisar sistema completo botonera mixer', 'Inspección'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Revisar apriete tornillería completo. Loctite 277', 'Inspección'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Engrasar pista mezclador completo. 2 kg hasta cubrir circunferencia', 'Lubricación'),
('204c76db-b192-4f1b-9de0-aaa2aaf71d31', 'Engrasar todos los puntos mixer. 2 kg NLGI-2', 'Lubricación');

INSERT INTO maintenance_tasks (interval_id, description, type) VALUES
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Cambiar aceite y filtro motor. 42 L, SAE 10W40', 'Reemplazo'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Calibrar válvulas culata si es necesario. Admisión 0.50mm, Escape 0.80mm', 'Calibración'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Cambiar filtro aire primario (exterior)', 'Reemplazo'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Cambiar filtro aire secundario (interior)', 'Reemplazo'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Cambiar filtros combustible completos', 'Reemplazo'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Cambiar filtro sistema SCR', 'Reemplazo'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Cambiar correa motor si es necesario. Revisar tensor', 'Reemplazo'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Cambiar refrigerante completo. 55 L, MAN-324 type SNF, -37°C', 'Reemplazo'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Limpiar radiadores completo', 'Limpieza'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Revisar nivel fluido embrague. 0.5 L (cambio 1,800 hr)', 'Inspección'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Calibrar carrera servo embrague. 27-30mm', 'Calibración'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Revisar nivel transmisión ZF. 25 L (cambio 1,800 hr)', 'Inspección'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Revisar nivel dirección. 2 L (cambio 1,800 hr)', 'Inspección'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Cambiar grasa completa lubricación cubos. 1.3 kg, tuercas, chavetas, reténes', 'Reemplazo'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Cambiar aceite eje equilibrio 6x4. 2 L, SAE 75W90', 'Reemplazo'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Cambiar gas A/C cabina completo. 0.7 kg, R134a, usar recuperador', 'Reemplazo'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Cambiar filtro antipolen A/C', 'Reemplazo'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Revisar y limpiar sistema eléctrico completo', 'Limpieza'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Revisar sistema completo botonera mixer', 'Inspección'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Revisar apriete tornillería completo. Loctite 277', 'Inspección'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Engrasar pista mezclador completo. 2 kg hasta cubrir circunferencia', 'Lubricación'),
('73438431-dd6c-4f26-ae0a-9f1d53a8954b', 'Engrasar todos los puntos mixer. 2 kg NLGI-2', 'Lubricación');
