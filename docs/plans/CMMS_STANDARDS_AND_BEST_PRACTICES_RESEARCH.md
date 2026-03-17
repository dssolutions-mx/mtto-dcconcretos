# CMMS/EAM Standards and Work Order Best Practices – Research Summary

*For maintenance lead engineers validating or critiquing application design. Based on ISO 55000, ISO 14224, MIMOSA, PAS 55, and industry best practices.*

---

## 1. Standards Overview: What They Prescribe for Work Order Lifecycle

### ISO 55000 Series (Asset Management)

| Standard | Scope | Work Order Relevance |
|----------|-------|----------------------|
| **ISO 55000:2014** | Overview, principles, terminology | Establishes asset management language and lifecycle concepts |
| **ISO 55001:2024** | Requirements for asset management system | Planning (Clause 6), Operation (Clause 8), Performance Evaluation (Clause 9) apply to maintenance execution and feedback loops |
| **ISO 55002:2018** | Guidelines for applying ISO 55001 | Interpretive guidance for asset management processes |

**Key prescription:** ISO 55000 does **not** prescribe a specific work order lifecycle. It requires organizations to define:
- Asset strategies and job plans in CMMS (derived from RCM/PMO)
- Long-range plans with data quality standards
- Department procedures and work instructions
- Feedback loops for performance evaluation and improvement

Work order lifecycle is implied by operational control (Clause 8) and improvement (Clause 10), but the **structure** of that lifecycle is left to the organization.

---

### ISO 14224:2016 (Reliability & Maintenance Data)

**Purpose:** Standardized collection and exchange of reliability and maintenance data for petroleum, petrochemical, and natural gas industries. Widely used as a reference model in other sectors.

**Three main data categories:**

| Category | What to Collect |
|----------|------------------|
| **Equipment data** | Taxonomy, attributes, functional location |
| **Failure data** | Cause, consequence, detection method, failed part, failure mechanism |
| **Maintenance data** | Maintenance action, resources used, consequence, downtime |

**ISO 14224 structure for maintenance records:**
- **Problem** — Complaint/issue reported
- **Detection method** — How found (inspection, alarm, casual observation)
- **Part that failed** — Component requiring repair
- **Failure mechanism** — What happened (e.g. seized, corroded)
- **Cause** — Why it occurred
- **Activity/maintenance action** — Corrective action taken
- **Maintenance consequence** — Results
- **Downtime** — Duration of unavailability

**Actionable point:** Align work order fields (description, evidence, cause codes) with ISO 14224’s problem → failure mechanism → cause → action → consequence model for interoperable data and benchmarking.

---

### MIMOSA (Machinery Information Management Open Standards Alliance)

**Work order structure (CCOM BODs):**
- Description of work
- Creation timestamp
- Priority level
- Work management type (preventive/corrective/etc.)
- Work task type
- Assigned agent/technician
- Associated solution package (pre-planned job)
- Functional location / serialized asset / equipment model

**Operations:** `ProcessRequestForWork`, `AcknowledgeRequestForWork`, `ShowWorkOrders`, `GetWorkOrders` — supports integration with condition-based systems (CBM) and asset management systems.

**Actionable point:** For interoperability, map internal WO fields to MIMOSA’s `WorkTaskType`, `WorkManagementType`, `PriorityLevelType`, `SegmentType`, `AssetType`, `AgentType` where applicable.

---

### PAS 55 (Physical Asset Management)

PAS 55 is a BSI specification (2004/2008), largely superseded by ISO 55001, but still referenced in asset-intensive sectors.

**Maintenance-related elements:**
- Work order creation, assignment, and completion
- Preventive maintenance scheduling
- CMMS use for workflow and data-driven decisions
- Performance monitoring and KPIs

**Actionable point:** Treat PAS 55 as legacy; use ISO 55001:2024 for certification and modern interpretation.

---

## 2. Work Order Creation: What to Capture When

### Creation vs. Planning vs. Execution

| Phase | What to Capture | Who Typically Provides |
|-------|------------------|------------------------|
| **Creation** | Asset (required), problem description, requester, origin (incident/plan/ad-hoc), optional photo(s), urgency indicator | Requestor or system (if auto-generated) |
| **Planning** | Labor requirements, parts list, tools/vehicles, `planned_date`, `due_date`, assignee, estimated duration, cost estimate, job plan/steps | Planner / scheduler |
| **Execution** | Actual start/finish, labor hours, parts used, completion photos, notes, root cause (if corrective) | Technician / supervisor |

### Industry Practice (Oxmaint, Oracle, Sockeye, Sensys)

1. **Creation should be fast** — Target <60 seconds for manual creation with a well-designed CMMS.
2. **Minimum viable at creation:** Asset, description (or reference to failure/inspection), requester. Photos reduce ambiguity.
3. **Planning enriches:** Don’t overload creation; planning adds labor, parts, dates, and assignee.
4. **Execution captures reality:** Actual hours, parts consumed, and completion evidence.

### Corrective vs. Preventive: Best Practice

| Aspect | Corrective | Preventive |
|--------|-----------|------------|
| **Trigger** | Failure, defect, alarm, inspection fail/flag | Schedule, meter, or condition threshold |
| **Creation** | As soon as fault detected; minimal manual input | From plan; inherits scope from maintenance plan |
| **Priority** | Often high/urgent; avoid requestor-driven assignment | Driven by plan; risk-based |
| **Scope** | May be unknown until diagnosis | Defined by job plan / checklist |
| **Templates** | Problem codes, failure types; standard corrective templates | Asset- or plan-specific templates |

**Recommendations:**
- **Corrective:** Require asset, problem description, detection method. Auto-populate from incident/checklist when applicable.
- **Preventive:** Link to `maintenance_plan_id`, inherit tasks and parts; use plan’s `next_due` for scheduling.
- **Ad-hoc:** Allow user-selected type; collect same minimum as corrective plus planned_date if known.

---

## 3. Scheduling: `planned_date`, Due Dates, Alerts, and Assignment

### Planned Date vs. Due Date

| Concept | Role |
|---------|------|
| **Planned date** | When work is intended to be done (scheduling target) |
| **Due date** | Deadline; compliance/compliance reporting target |

**Recommendation:** Keep both distinct. Use `planned_date` for scheduling; use due date (or derived deadline) for SLA/priority and alerts.

### Alerts

- **Overdue:** When current date > due date and status not completed.
- **Upcoming:** When planned date is within configurable window (e.g. 3–7 days).
- **Maintenance window:** Schedule PM during non-peak or shutdown; show asset availability.

### Maintenance Windows and Asset Availability

- Schedule preventive work in planned downtime or low-usage periods.
- Consider asset availability when suggesting `planned_date` (e.g. from production schedule or asset calendar).
- Avoid over-relying on due-date compliance: prioritize reporting all defects even if it delays PM compliance.

### Technician Assignment

- **Skill-based routing:** Match WO requirements to technician certifications and craft.
- **Workload visibility:** Balance queues by technician availability and travel time.
- **Mobile dispatching:** Technicians accept and update work on mobile devices.

**Recommendation:** Support both explicit assignment and skill-based/suggested assignment; avoid assigning complex tasks to underqualified technicians.

---

## 4. Auto-Created Work Orders: Workflow and User Input

### Standard Workflow

| Trigger | Typical Flow |
|---------|--------------|
| **Checklist fail/flag** | Inspection → corrective WO created; linked to failed item(s) and checklist |
| **Failure/condition** | Event/alarm → operational rule → WO with failure event attached |
| **Incident** | Incident with certain type/status → WO created with `incident_id` |

### When User Input Is Required

- **Before creation:** When operational rules are configured (e.g. failure codes, thresholds).
- **At creation:** Minimal — verify auto-generated description, adjust priority if needed, add notes.
- **Post-creation:** Planning and scheduling; user may change assignee, dates, parts.

### What Is Typically Editable Post-Creation

| Editable | Not Editable (or restricted) |
|----------|------------------------------|
| Priority | Origin (`incident_id`, `checklist_id`, `maintenance_plan_id`) |
| Assigned technician | Source reference (for audit traceability) |
| Planned date / due date | Creation timestamp |
| Description (additions) | Requester (original) |
| Parts list | |
| Estimated duration/cost | |

**Recommendation:** Allow edits to planning/execution fields (priority, assignee, dates, parts, duration) while preserving origin FKs and creation timestamp for traceability. Append user notes rather than overwriting auto-generated description.

---

## 5. Work Order – Procurement (Purchase Order) Integration

### WO Data That Should Feed PO

| WO Field | PO Use |
|----------|--------|
| Required parts list | Line items for requisition/PO |
| Quantity | Order quantity |
| `part_id` / part number | Catalog lookup, pricing |
| `estimated_cost` / unit price | Budget, approval thresholds |
| Asset / location | Routing, warehouse selection |

### Workflow

1. WO created with `required_parts` (estimated).
2. Planner/supervisor reviews and approves parts.
3. Requisition generated from WO; PO created (manual or automated).
4. PO linked to WO; status visible to technicians.
5. Receipt updates inventory; WO can show “parts available.”

### Approval Workflow

- Thresholds based on `estimated_cost` or labor+parts total.
- Auto-approve below threshold; route above threshold to supervisor or procurement.
- Mobile one-tap approval where appropriate.

**Recommendation:** Use a `PurchaseOrderItem`-style structure (`name`, `partNumber`, `quantity`, `unit_price`, `total_price`, `part_id`) consistently; support “Generate PO” from WO parts and link PO back to WO for traceability.

---

## 6. Prioritization and Escalation

### Priority Best Practice

- **4-tier model:**
  - **Critical/Emergency:** Safety, production halt, regulatory
  - **High:** Significant operational/safety risk, critical-asset PM
  - **Medium:** Can escalate if delayed; non-critical PM
  - **Low:** Cosmetic, minor, no safety/operational impact

- **Use objective scoring:** Asset criticality, safety impact, compliance deadlines, production impact, cost. Avoid requestor-assigned priority.
- **Target mix:** ~80% planned, ~20% unplanned/emergency.

### Escalation

- Define asset-specific SLAs and escalation rules.
- Escalate when overdue by X days or when recurrence count ≥ N.
- Track `related_issues_count`, `escalation_count`, `issue_history` for consolidated/recurring work.

### Recurrence

- Consolidate similar issues when recurrence_count < threshold; escalate when ≥ threshold.
- Record `issue_history` with dates for audit and RCA.
- Use recurrence data to adjust preventive plans and identify chronic failures.

**Recommendation:** Auto-calculate priority from asset criticality + impact; allow planner override with audit. Implement escalation and consolidation rules based on recurrence and SLA.

---

## 7. Evidence and Documentation

### Standard Practice: Creation vs. Progress vs. Completion

| Phase | Photo/Document Purpose |
|-------|------------------------|
| **Creation** | Problem identification, pre-repair condition, damage assessment |
| **Progress** | Work verification, in-progress state |
| **Completion** | Quality assurance, post-repair condition, warranty support |

### Typical Categories

- Problem identification
- Equipment condition (pre/during/post)
- Safety issues
- Parts documentation (warranty, serial numbers)
- Compliance records

### Alignment With Standards

- **ISO 14224:** Failure data and maintenance consequence require structured evidence; photos support detection method and maintenance action.
- **Audit/compliance:** Timestamped, categorized evidence supports traceability and dispute resolution.
- **Mobile:** Capture with timestamp, optional annotation; auto-attach to WO.

**Recommendation:** Support `creation_photos`, `progress_photos`, `completion_photos` (or equivalent) with `{ url, description, category, uploaded_at }`. Use consistent categories across creation flows. Mandate creation photos for non-emergency corrective work where feasible.

---

## Summary Table: Standards Reference

| Topic | Primary Standard | Key Prescription |
|-------|------------------|------------------|
| Asset management framework | ISO 55000/55001 | Define procedures; feedback loops; no fixed WO lifecycle |
| Failure/maintenance data | ISO 14224 | Problem → failure mechanism → cause → action → consequence |
| Interoperability | MIMOSA CCOM | Work order BODs; WorkTaskType, PriorityLevelType, AssetType |
| Legacy asset management | PAS 55 | Work order management, PM, CMMS, KPIs |
| Lifecycle stages | Industry consensus | Request → Triage → Assign → Execute → Close → Analyze |

---

## Validation Checklist for Application Design

Use this checklist against your current design:

- [ ] **Origin tracking:** All creation flows set correct `incident_id`, `checklist_id`, or `maintenance_plan_id`; ad-hoc leaves them null
- [ ] **Creation minimal:** Asset + description + requester at minimum; photos for non-emergency corrective
- [ ] **Planning distinct:** Labor, parts, dates, assignee captured in planning, not forced at creation
- [ ] **Corrective vs preventive:** Different creation paths; preventive inherits from plan
- [ ] **Planned vs due date:** Both modeled; used for scheduling vs compliance
- [ ] **Auto-creation:** Origin preserved; planning fields editable; description appendable
- [ ] **Procurement:** Parts schema supports PO generation; WO–PO linkage
- [ ] **Priority:** Objective criteria; escalation and recurrence logic
- [ ] **Evidence:** Creation / progress / completion categories; timestamps; consistent schema

---

*Sources: ISO 55000/55001/55002, ISO 14224:2016, MIMOSA CCOM/OIIE, PAS 55, Oracle FSCM, Oxmaint, Sockeye, MaintainX, Sensys, Reliabilityweb, IAM Knowledge Library, industry CMMS documentation.*
