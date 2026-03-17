# Executive & CMMS Dashboard Best Practices for General Managers

> Research synthesis: executive dashboard best practices, CMMS-specific metrics, information hierarchy, and actionable vs. informational balance. Includes prioritized component recommendations for MantenPro (Gerencia General).

---

## 1. Executive Dashboard Best Practices

### Core Design Principles

| Principle | Description | Source |
|-----------|-------------|--------|
| **Strategic alignment** | Start with strategic questions, not data. Link KPIs to business goals using frameworks like Balanced Scorecard (financial, customer, internal processes, learning/innovation). | Lets-Viz, Gartner |
| **3-second test** | Dashboards should answer top business questions in 3–5 seconds. Enable quick answers to critical questions without extensive cognitive processing. | Kubit, NN/G |
| **Limited metrics** | 6–8 key metrics maximum for executive dashboards; 5–7 for optimal comprehension. More dilutes focus; human working memory holds only 3–5 items at once. | Lets-Viz, NN/G, UX Pilot |
| **Purpose-driven** | Every element must map to a user decision. If a metric doesn't trigger action, remove it. | NN/G, Boundev |
| **Top-down storytelling** | KPIs that summarize health at top → breakdown by segment → trends/forecasts at bottom. | Lets-Viz |
| **Question-first design** | Design around specific user questions ("Are we on track?", "What risks are emerging?") rather than data availability. | Lets-Viz, Medium (Sahar) |

### What C-Level/General Manager Dashboards Typically Show

- **Financial**: Revenue/MRR, gross margin, EBITDA, cash runway, burn rate, spend vs. budget
- **Strategic**: YoY performance, progress against quarterly goals, variance explanations
- **Operational**: Efficiency ratios, team headcount, key process metrics
- **Customer/outcomes**: NPS, churn, satisfaction (where applicable)

### Design Frameworks

**Nielsen Norman Group (NN/G):**
- Dashboards are for at-a-glance consumption, not data exploration
- Operational vs. analytical: C-suite needs strategic summaries
- Cognitive load: limit to 5–7 KPIs before comprehension drops
- Avoid decorative elements (borders, gradients, 3D) that consume cognitive resources

**Balanced Scorecard (Kaplan & Norton):**
- Financial, Customer, Internal processes, Learning/innovation
- Ensures metrics connect to strategy, not just operational activity

**C³ Model (Clarity, Context, Continuity):**
- Clarity: consistent visuals, limit to 8 KPIs
- Context: annotations, variance text, narrative layers
- Continuity: align with evolving goals, review quarterly

### Common Pitfalls to Avoid

- Too many metrics (>15); vanity metrics without context
- No drill-down capability; poor mobile experience
- Stale or inaccurate data
- No link between metrics and decision pathways

---

## 2. CMMS-Specific Executive Views

### Metrics That Matter for a GM Overseeing Maintenance

| Category | Metric | Why It Matters |
|----------|--------|----------------|
| **Financial** | Maintenance cost vs. budget | ~41% of orgs allocate >10% of operating budget to maintenance. GM needs visibility into spend. |
| **Financial** | Spend by category (labor, materials, contractors) | Supports capital planning and cost optimization |
| **Asset health** | Asset uptime / production availability | Direct link to revenue and operational risk |
| **Asset health** | Unplanned downtime costs | Revenue protection, prioritization |
| **Efficiency** | Planned vs. reactive work ratio | Leading indicator: world-class = 85–90% planned; reactive = costly |
| **Efficiency** | PM (Preventive Maintenance) compliance | Target ≥90%; <70% = critical |
| **Backlog** | Backlog aging (0–7, 8–14, 15–30, 31+ days) | Unmanaged backlog → 23% more emergency spend, 18% less availability |
| **Compliance** | PM compliance rate, schedule compliance | Regulatory and operational assurance |
| **Workflow** | Work order status distribution | Open, In Progress, On Hold; priority-based remaining work |
| **Approvals** | Pending approvals (by threshold) | GM often approves high-value POs (e.g., ≥$7k) |
| **Vendor** | Vendor SLA compliance | Contract optimization |
| **Safety** | Safety incident trends | Compliance assurance |
| **ROI** | Preventive maintenance ROI | Demonstrates value of maintenance investments |

### Real Products Reference

**IBM Maximo:**
- Overdue emergency work, overdue PM, PM performance, asset health
- KPI trend vs. targets; workflow assignments due within 24h
- Role-based dashboards; customizable cards
- Quick actions for work orders, purchase requests

**Fiix CMMS:**
- Customizable interactive dashboard; work order, inventory, KPI visibility
- Bird's-eye view of maintenance operations
- Customized and scheduled reports by team

**LLumin / CMMS Executive Reporting:**
- Asset uptime, maintenance cost vs. budget, PM ROI
- Unplanned downtime costs, asset lifecycle, vendor SLA
- Safety incident trends, energy metrics

**Business impact** (organizations implementing data-driven dashboards): 28% increase in asset life, 545% avg ROI from reporting CMMS, 20%+ reduction in downtime, 15% lower labor costs (Oxmaint, LLumin, Limble).

---

## 3. Information Hierarchy

### Above the Fold (Primary)

- **3–5 most critical KPIs** in the top row
- **Most important metric** in top-left quadrant (F-pattern)
- **Action strip / hero** as focal point (things requiring immediate attention)
- No competing hero areas; avoid dense metric grids (4+ equal cards)

### Middle Section (Secondary)

- Trend charts, time-series data
- Segment/department breakdowns
- Shortcuts to key modules

### Bottom / Below the Fold (Tertiary)

- Detailed breakdowns, tables
- Drill-down paths
- Secondary modules (progressive disclosure)

### Visual Hierarchy Techniques

- **Size**: Primary KPIs significantly larger
- **Position**: Top-left for highest importance
- **Color**: Sparingly—green (on track), red (attention), amber (caution)
- **Font weight**: Bold for primary; regular/italic for secondary
- **Squint test**: Hierarchy still visible when blurred

### MantenPro Alignment

Per `DASHBOARD_UI_DESIGN_PRINCIPLES.md`:
- Max 2–3 primary elements above the fold
- One hero (action strip) per role
- Progressive disclosure; generous space
- No dense metric grids

---

## 4. Actionable vs. Informational

### The Critical Distinction

| Type | Purpose | Example |
|------|---------|---------|
| **Actionable** | Connect data to decisions; trigger specific responses | "5 OCs esperan aprobación → Aprobar" |
| **Informational** | Display what happened without guidance | "Costos por categoría (último mes)" |

### Actionable Dashboard Characteristics

- Every metric has an associated action and clear decision trigger
- Named operational levers explaining metric movement
- Clear corrective actions tied to each KPI
- Accountability: one owner per metric
- Real-time or near-real-time for urgent decisions

### GM-Specific Balance

For **Gerencia General**, both matter:

| Actionable (Things to Do) | Informational (Things to Know) |
|---------------------------|--------------------------------|
| OCs ≥$7k esperan aprobación | Cost trends vs. budget |
| Exceptions requiring override | Work order status distribution |
| Critical alerts (e.g., overdue emergency work) | PM compliance trend |
| Approval queue count | Backlog aging |
| | Asset uptime / availability |
| | Planned vs. reactive work ratio |

**Recommendation:** Lead with actionable (hero action strip); follow with informational (KPI summary, trends). Actionable content should be above the fold; informational can be in the middle/bottom with drill-down.

### Design Principles for Actionability

- **Simplicity**: 3–5 KPIs in primary view; drill-downs for drivers
- **Decision pathways**: When X drops 20%, who gets notified and what are response options?
- **Time tier**: Urgent (minute-hour) vs. strategic (weekly-monthly) updates

73% of operational dashboards are abandoned when not designed for decision-makers' actual needs (ThickDot). Organizations connecting metrics to actions see ~40% faster decision cycles (InfluenceFlow).

---

## 5. Prioritized Components for MantenPro GM Dashboard

Based on research, MantenPro domain (maintenance, assets, POs, checklists), and existing `DASHBOARD_ROLE_ACTION_MAP.md`:

### Priority 1 (Must Have — Above the Fold)

| # | Component | Type | Rationale |
|---|-----------|------|-----------|
| 1 | **Approval action strip** | Actionable | Already implemented: N OCs ≥$7k esperan aprobación → Aprobar. GM's primary daily action. |
| 2 | **Maintenance cost vs. budget** | Informational | Executive-level financial visibility; ~41% of orgs allocate >10% to maintenance. |
| 3 | **Critical alerts (exceptions)** | Actionable | Overdue emergency work, overdue PM, assets down—things requiring immediate attention. |

### Priority 2 (Highly Recommended — Primary Section)

| # | Component | Type | Rationale |
|---|-----------|------|-----------|
| 4 | **Work order status distribution** | Informational | Open / In Progress / On Hold; quick health check of maintenance pipeline. |
| 5 | **PM / checklist compliance** | Informational | Leading indicator; target ≥90%; ties to preventive work and operational maturity. |
| 6 | **Planned vs. reactive work ratio** | Informational | World-class = 85–90% planned; supports strategic messaging about maintenance maturity. |
| 7 | **Backlog summary (aging buckets)** | Informational | 0–7, 8–14, 15–30, 31+ days; unmanaged = 23% more emergency spend. |

### Priority 3 (Secondary — Below the Fold / Modules)

| # | Component | Type | Rationale |
|---|-----------|------|-----------|
| 8 | **Spend by category** | Informational | Labor, materials, POs—supports capital planning. |
| 9 | **Asset uptime / availability** | Informational | Link to revenue and risk; executive cares about reliability. |
| 10 | **Cost trend (sparkline / mini chart)** | Informational | MoM or YoY; adds context to current spend. |
| 11 | **Shortcuts** | Navigation | Reportes, Configuración (already in map); add link to Gerencial Report. |
| 12 | **Approval queue detail (link)** | Actionable | Drill-down from action strip to full PO list. |

### Implementation Order

1. **Keep** approval action strip as hero (already correct).
2. **Add** maintenance cost vs. budget KPI card.
3. **Add** critical alerts widget (overdue emergency, overdue PM, critical assets).
4. **Add** work order status distribution (simple bar or stacked bar).
5. **Add** PM/checklist compliance percentage.
6. **Add** planned vs. reactive work ratio.
7. **Add** backlog aging summary.
8. **Add** spend-by-category breakdown (or link to gerencial report).
9. **Add** asset uptime / availability.
10. **Add** cost trend sparkline.
11. **Ensure** shortcuts include Reportes (Gerencial).
12. **Ensure** action strip CTA links to approval queue.

---

## 6. Summary Checklist

- [ ] Hero: Approval action strip (already implemented)
- [ ] Primary KPI: Maintenance cost vs. budget
- [ ] Critical alerts: Overdue emergency work, overdue PM, critical assets
- [ ] Work order status distribution
- [ ] PM/checklist compliance rate
- [ ] Planned vs. reactive work ratio
- [ ] Backlog aging (0–7, 8–14, 15–30, 31+)
- [ ] Spend by category (or link to report)
- [ ] Asset uptime / availability
- [ ] Cost trend sparkline
- [ ] Shortcuts: Reportes, Configuración, Gerencial
- [ ] Drill-down from action strip to PO list

---

## Sources

- **Lets-Viz** – Executive dashboard best practices (2025)
- **Improvado, Kubit, AppDeck** – Executive dashboard examples and templates
- **Nielsen Norman Group** – Dashboard design, preattentive processing
- **LLumin** – CMMS executive reporting dashboards
- **Oxmaint** – Maintenance KPIs, backlog management
- **PreventiveHQ, Limble** – CMMS success metrics
- **IBM Maximo Documentation** – Operational dashboard features
- **Fiix CMMS** – Dashboard features
- **InfluenceFlow, ThickDot** – Actionable dashboards
- **Boundev, 5of10, DesignX** – Dashboard design principles
- **Project docs** – DASHBOARD_UI_DESIGN_PRINCIPLES.md, DASHBOARD_ROLE_ACTION_MAP.md
