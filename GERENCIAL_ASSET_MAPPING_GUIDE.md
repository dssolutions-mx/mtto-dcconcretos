# Gerencial Report - Asset & Plant Mapping Guide

## Overview

The Gerencial Report integrates data from two separate Supabase databases:
1. **Maintenance** (txapndpstzcspgxlybll) - Asset management, diesel, maintenance
2. **Cotizador** (pkjqznogflgbnwzkzmpg) - Sales, concrete deliveries, remisiones

Since these databases have different UUIDs for the same physical entities (plants, assets), we need mapping strategies.

---

## Plant Mapping (Automatic)

**How it works:**
- Plants are matched by their `code` field (P001, P002, P003, etc.)
- The API automatically maps cotizador plant IDs to maintenance plant IDs

**Example:**
```
Cotizador DB:
- ID: 4cc02bc8-990a-4bde-96f2-7a1f5af4d4ad
- Name: "León Planta 1"
- Code: "P001"

Maintenance DB:
- ID: e2b70d92-929e-42f3-9428-4a4c57b49460
- Name: "León/Planta 1"  
- Code: "P001"

→ Matched by code "P001"
```

**What you need to do:**
✅ **Nothing!** Plant matching is automatic as long as codes match.

**If plants aren't matching:**
1. Check that plant codes are identical in both databases:
```sql
-- In Cotizador:
SELECT id, name, code FROM plants ORDER BY name;

-- In Maintenance:
SELECT id, name, code FROM plants ORDER BY name;
```

2. Update codes to match if needed:
```sql
UPDATE plants SET code = 'P001' WHERE name LIKE '%León%Planta 1%';
```

---

## Asset Mapping (Semi-Automatic)

**The Challenge:**
- Cotizador uses unit strings like "CR-19", "BP-04", "CR-26"
- Maintenance has assets with codes and IDs
- We need to link them

**Automatic Matching (First Try):**
The system automatically tries to match by `asset_code`:
```
Cotizador Sales:
- asset_name: "CR-19"

Maintenance Assets:
- asset_id (code): "CR-19"  
- id: <uuid>

→ Automatically matched!
```

**Manual Mapping (For mismatches):**
If asset codes don't match exactly, use the `asset_name_mappings` table:

### Step 1: Identify Unmapped Assets

Check the server logs for:
```
salesMatched: 15
salesUnmatched: 5  ← These need manual mapping
```

### Step 2: Find Cotizador Asset Names

```sql
-- Run in Cotizador DB
SELECT DISTINCT asset_name, COUNT(*) as sales_count
FROM sales_assets_weekly
WHERE week_start >= '2025-01-01'
GROUP BY asset_name
ORDER BY sales_count DESC;
```

Example output:
```
CR-19  →  52 sales
CR-20  →  48 sales
BP-04  →  35 sales
CR-15  →  75 sales
```

### Step 3: Find Matching Assets in Maintenance

```sql
-- Run in Maintenance DB
SELECT id, asset_id, name, plant_id
FROM assets
WHERE asset_id LIKE '%CR%' OR asset_id LIKE '%BP%'
ORDER BY asset_id;
```

### Step 4: Create Mappings

For each unmatched asset, insert a mapping:

```sql
INSERT INTO public.asset_name_mappings (
  asset_id,              -- UUID from maintenance DB
  original_name,         -- Friendly name for reference
  external_unit,         -- EXACT string from cotizador (CR-19, BP-04, etc.)
  source_system,         -- Must be 'cotizador'
  mapping_type,          -- 'manual', 'automatic', or 'fuzzy'
  confidence_level       -- 1.0 for exact, <1.0 for fuzzy
) VALUES (
  '<maintenance-asset-uuid>',
  'Camión Revolvedora 19',
  'CR-19',
  'cotizador',
  'manual',
  1.0
);
```

**Complete Example:**
```sql
-- Map CR-19 from cotizador to CR-19 in maintenance
INSERT INTO public.asset_name_mappings 
(asset_id, original_name, external_unit, source_system, mapping_type, confidence_level)
VALUES 
('a1b2c3d4-e5f6-4789-a012-3456789abcde', 'Camión Revolvedora 19', 'CR-19', 'cotizador', 'manual', 1.0);

-- Map BP-04 from cotizador to different code in maintenance
INSERT INTO public.asset_name_mappings 
(asset_id, original_name, external_unit, source_system, mapping_type, confidence_level)
VALUES 
('x1y2z3w4-v5u6-7890-t123-456789uvwxyz', 'Bomba de Concreto 04', 'BP-04', 'cotizador', 'manual', 1.0);
```

### Step 5: Verify Mappings

```sql
SELECT 
  anm.external_unit,
  a.asset_id as maintenance_code,
  a.name as asset_name,
  p.name as plant_name
FROM asset_name_mappings anm
JOIN assets a ON a.id = anm.asset_id
JOIN plants p ON p.id = a.plant_id
WHERE anm.source_system = 'cotizador'
ORDER BY anm.external_unit;
```

### Step 6: Test

1. Refresh the gerencial report
2. Check server logs:
```
salesMatched: 20  ← Should increase
salesUnmatched: 0  ← Should decrease
totalSales: 1500000  ← Should show actual sales
```

---

## Bulk Mapping Script

If you have many assets to map, use this script:

```sql
-- First, create a temp mapping table
CREATE TEMP TABLE temp_asset_mappings (
  cotizador_name text,
  maintenance_code text
);

-- Insert your mappings
INSERT INTO temp_asset_mappings VALUES
('CR-19', 'CR-19'),
('CR-20', 'CR-20'),
('CR-15', 'CR-15'),
('CR-26', 'CR-26'),
('BP-04', 'BP-04');

-- Generate insert statements
INSERT INTO public.asset_name_mappings 
(asset_id, original_name, external_unit, source_system, mapping_type, confidence_level)
SELECT 
  a.id,
  a.name,
  tam.cotizador_name,
  'cotizador',
  'automatic',
  1.0
FROM temp_asset_mappings tam
JOIN assets a ON a.asset_id = tam.maintenance_code
WHERE NOT EXISTS (
  SELECT 1 FROM asset_name_mappings anm
  WHERE anm.external_unit = tam.cotizador_name
  AND anm.source_system = 'cotizador'
);
```

---

## Troubleshooting

### Sales still showing $0

**Check plant mapping:**
```sql
-- Count matched plants
SELECT COUNT(DISTINCT p1.code)
FROM (SELECT code FROM plants) p1  -- maintenance
JOIN (SELECT code FROM plants) p2  -- cotizador (different DB)
  ON p1.code = p2.code;
```

**Check asset mapping:**
```sql
-- Show mapped vs unmapped
SELECT 
  (SELECT COUNT(*) FROM asset_name_mappings WHERE source_system = 'cotizador') as mapped_count,
  (SELECT COUNT(DISTINCT asset_name) FROM sales_assets_weekly) as total_cotizador_assets;
```

### Specific asset not linking

1. **Check if asset exists in maintenance:**
```sql
SELECT id, asset_id, name 
FROM assets 
WHERE asset_id ILIKE '%CR-19%';
```

2. **Check if mapping exists:**
```sql
SELECT * 
FROM asset_name_mappings 
WHERE external_unit = 'CR-19' 
AND source_system = 'cotizador';
```

3. **Check case sensitivity:**
   - Mappings are case-insensitive (converted to uppercase)
   - But double-check exact strings in cotizador

4. **Check plant assignment:**
```sql
-- Asset must belong to a plant that exists in cotizador
SELECT a.asset_id, a.name, p.name as plant, p.code
FROM assets a
JOIN plants p ON p.id = a.plant_id
WHERE a.asset_id = 'CR-19';
```

### Server logs show mapping errors

Look for these in the console:
```
plantMappings: 4  ← Should match number of shared plants
salesMatched: X
salesUnmatched: Y
```

If `plantMappings: 0`, your plant codes don't match between databases.

---

## Best Practices

1. **Use exact strings** - Copy asset names directly from cotizador
2. **Map by plant** - Focus on one plant at a time
3. **Test incrementally** - Add a few mappings, test, repeat
4. **Document aliases** - If CR-19 has other names, note them
5. **Regular audits** - New assets in cotizador need manual mapping

---

## Quick Start Checklist

- [ ] Verify plant codes match in both databases
- [ ] Run Step 2 query to list cotizador assets
- [ ] Run Step 3 query to list maintenance assets
- [ ] Create mappings for top 10 most-used assets
- [ ] Refresh report and check salesMatched count
- [ ] Map remaining assets as needed

---

## Success Criteria

You'll know it's working when:
- ✅ `salesMatched` = `salesRowsCount` (or close)
- ✅ `totalSales` shows actual revenue numbers
- ✅ Assets tab shows sales data per asset
- ✅ Business Units and Plants show aggregated sales

**Need help?** Share your server logs and we'll debug together!

