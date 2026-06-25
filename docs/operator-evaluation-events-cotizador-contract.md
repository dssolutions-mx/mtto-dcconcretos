# Operator evaluation events — Cotizador sync contract

This document defines the JSON contract for a **future** sync from Mantenimiento (`operator_evaluation_events`) into Cotizador compliance / bonus modules. **No sync implementation exists in Mantenimiento** — events are written at checklist completion time only.

## Source table

`public.operator_evaluation_events` — one row per operator per evaluation action.

## Event types

| `event_type` | Origin | `status` values |
|---|---|---|
| `punctuality` | PLANTA daily checklist, `operator_punctuality` section | `on_time`, `late`, `absent` |
| `cleanliness_weekly` | Asset weekly checklist, `cleanliness_bonus` items | `pass`, `fail` |
| `cleanliness_closure` | PLANTA monthly checklist, `bonus_closure` section | `eligible`, `ineligible` |
| `security_talk` | Any checklist with `security_talk` section | `attended` |

## Idempotency key (consumer)

```
source_completion_id + operator_id + event_type
```

Re-completing the same schedule updates rows in place (delete + insert per type).

## Export payload (batch)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "OperatorEvaluationEventBatch",
  "type": "object",
  "required": ["exported_at", "source_system", "events"],
  "properties": {
    "exported_at": {
      "type": "string",
      "format": "date-time",
      "description": "UTC timestamp when the batch was produced"
    },
    "source_system": {
      "type": "string",
      "const": "mtto-dcconcretos"
    },
    "events": {
      "type": "array",
      "items": { "$ref": "#/$defs/OperatorEvaluationEvent" }
    }
  },
  "$defs": {
    "OperatorEvaluationEvent": {
      "type": "object",
      "required": [
        "id",
        "plant_id",
        "operator_id",
        "event_type",
        "event_date",
        "status",
        "idempotency_key"
      ],
      "properties": {
        "id": { "type": "string", "format": "uuid" },
        "plant_id": { "type": "string", "format": "uuid" },
        "operator_id": { "type": "string", "format": "uuid" },
        "operator_employee_code": { "type": ["string", "null"] },
        "event_type": {
          "type": "string",
          "enum": [
            "punctuality",
            "cleanliness_weekly",
            "cleanliness_closure",
            "security_talk"
          ]
        },
        "event_date": { "type": "string", "format": "date" },
        "period_year": { "type": ["integer", "null"], "minimum": 2000 },
        "period_month": { "type": ["integer", "null"], "minimum": 1, "maximum": 12 },
        "status": { "type": "string" },
        "source_schedule_id": { "type": ["string", "null"], "format": "uuid" },
        "source_completion_id": { "type": ["string", "null"], "format": "uuid" },
        "section_id": { "type": ["string", "null"], "format": "uuid" },
        "reason": { "type": ["string", "null"] },
        "evidence": {
          "type": ["array", "null"],
          "items": {
            "type": "object",
            "required": ["photo_url"],
            "properties": {
              "photo_url": { "type": "string" },
              "category": { "type": "string" },
              "description": { "type": "string" }
            }
          }
        },
        "metadata": { "type": ["object", "null"] },
        "created_at": { "type": "string", "format": "date-time" },
        "idempotency_key": {
          "type": "string",
          "description": "{source_completion_id}:{operator_id}:{event_type}"
        }
      }
    }
  }
}
```

## Example event (punctuality)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "plant_id": "plant-uuid",
  "operator_id": "operator-uuid",
  "operator_employee_code": "OP-042",
  "event_type": "punctuality",
  "event_date": "2026-06-25",
  "period_year": null,
  "period_month": null,
  "status": "late",
  "source_schedule_id": "schedule-uuid",
  "source_completion_id": "completion-uuid",
  "section_id": "section-uuid",
  "reason": "Llegó 15 min después",
  "evidence": null,
  "metadata": { "had_production": true },
  "created_at": "2026-06-25T14:30:00Z",
  "idempotency_key": "completion-uuid:operator-uuid:punctuality"
}
```

## Example event (monthly closure)

```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "plant_id": "plant-uuid",
  "operator_id": "operator-uuid",
  "operator_employee_code": "OP-042",
  "event_type": "cleanliness_closure",
  "event_date": "2026-06-24",
  "period_year": 2026,
  "period_month": 6,
  "status": "eligible",
  "source_schedule_id": "schedule-uuid",
  "source_completion_id": "completion-uuid",
  "section_id": "section-uuid",
  "reason": null,
  "evidence": [
    {
      "photo_url": "https://…/bono_limpieza.jpg",
      "category": "bono_limpieza",
      "description": "Evidencia de bono"
    }
  ],
  "metadata": {
    "weekly_pass_rate": 0.85,
    "evaluation_ids": ["eval-1", "eval-2"],
    "system_suggested_eligible": true
  },
  "created_at": "2026-06-24T18:00:00Z",
  "idempotency_key": "completion-uuid:operator-uuid:cleanliness_closure"
}
```

## Mantenimiento read API

`GET /api/hr/operator-evaluations`

Query params: `plant_id`, `operator_id`, `year`, `month`, `event_type`, `limit` (max 500).

Auth: `canAccessRHReporting`.

Response includes `operator_name` and `employee_code` joined from `profiles`.

## Out of scope (explicit)

- Cotizador HTTP/webhook consumer
- `compliance_incidents` auto-creation
- Sanctions or payroll calculation
