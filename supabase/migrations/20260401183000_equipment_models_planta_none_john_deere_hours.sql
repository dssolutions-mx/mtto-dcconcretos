-- DC CONCRETOS "PLANTA" model: no physical horómetro/odómetro — hide readings on checklists
UPDATE equipment_models
SET maintenance_unit = 'none', updated_at = now()
WHERE id = '2c7bcf18-8a9c-4c9b-b85f-702ee0177896';

-- John Deere equipment models: maintain by hours only (horómetro, not odómetro)
UPDATE equipment_models
SET maintenance_unit = 'hours', updated_at = now()
WHERE lower(trim(manufacturer)) = 'john deere';
