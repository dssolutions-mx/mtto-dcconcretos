-- Equipment models metadata cleanup and removal of 3 unused Mitsubishi U-11 duplicates.
-- Scope: metadata fixes + delete only zero-asset/zero-interval Mitsubishi dupes (MOD27742, MOD37696, MOD65818).
-- Does NOT touch Ford F250 duplicates, orphan International/John Deere models, or MOD89994 (asset U-11).

-- Phase 1: metadata fixes first
UPDATE equipment_models SET manufacturer = 'JOHN DEERE'
 WHERE id = '638340f5-094e-439e-b7f4-ec942bb83f5d';

UPDATE equipment_models SET manufacturer = 'KENWORTH'
 WHERE id = '7d1deb73-02ce-491a-a6de-764459eb0d57';

UPDATE equipment_models SET manufacturer = 'MITSUBISHI'
 WHERE manufacturer IN ('MITSUBISHI MOTORS', 'MITSUBISHI');

UPDATE equipment_models SET
 name = TRIM(name),
 manufacturer = TRIM(manufacturer)
WHERE name != TRIM(name) OR manufacturer != TRIM(manufacturer);

UPDATE equipment_models SET
 name = 'INTERNATIONAL-TRACTOCAMION-LONG CHASIS',
 model_id = 'INT-IN-2926'
WHERE id = '4556ccdd-948a-4d1e-a7db-d92ee3406514';

UPDATE equipment_models SET
 name = 'PICKUP L200 GLX DSL TM4X4 TM AUTOMATICA 6 VEL'
WHERE id = '84b937ea-0ba4-4bb7-a148-456eb0f73da7';

-- Phase 2: delete only 3 Mitsubishi U-11 duplicates
DELETE FROM equipment_models
WHERE id IN (
 '0636a8cb-92eb-40b9-a587-c390d95867df',
 '4ed1e0df-8340-447f-ad59-b3251c316b72',
 '216ffe4d-701e-445f-85ae-07a478ed09a0'
);
