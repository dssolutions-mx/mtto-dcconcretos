-- Mezcladoras de concreto y camiones: mantenimiento por horas e intervalos en horas,
-- pero checklist debe capturar horómetro y odómetro (maintenance_unit = both).
UPDATE equipment_models
SET maintenance_unit = 'both', updated_at = now()
WHERE category IN ('Mezcladora de Concreto', 'Camión');
