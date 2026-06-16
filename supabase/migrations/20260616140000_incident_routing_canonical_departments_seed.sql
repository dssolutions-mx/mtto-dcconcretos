-- Seed canonical incident-routing departments per plant (idempotent).
-- Maps to app buckets: MANT, OPER, RH, CAL (see lib/incidents/incident-routing-departments.ts).
-- Legacy PROD/Producción rows remain and also match operaciones in app code.

INSERT INTO public.departments (plant_id, code, name)
SELECT p.id, seed.code, seed.name
FROM public.plants p
CROSS JOIN (
  VALUES
    ('OPER', 'Operaciones'),
    ('RH', 'Recursos Humanos'),
    ('CAL', 'Calidad')
) AS seed(code, name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.departments d
  WHERE d.plant_id = p.id
    AND lower(d.code) = lower(seed.code)
);
