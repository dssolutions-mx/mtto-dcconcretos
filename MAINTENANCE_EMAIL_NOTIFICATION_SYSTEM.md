# Maintenance Dashboard - Email Notification System Implementation Guide

## Executive Summary

This document outlines the comprehensive email notification system designed to provide critical oversight and micromanagement capabilities for the maintenance dashboard. The system addresses organizational gaps by providing daily and scheduled reports to enable data-driven maintenance management.

## System Architecture Overview

### Database Structure Analysis

Based on Supabase MCP analysis, the maintenance dashboard contains the following key tables:

#### Core Entities
- **`assets`** (47 records) - Equipment/asset information with hours/kilometers tracking
- **`checklist_schedules`** (759 records) - Scheduled checklist executions  
- **`completed_checklists`** (615 records) - Completed checklist records with status
- **`checklist_issues`** (1,348 records) - Issues found during checklists 
- **`work_orders`** (326 records) - Maintenance work orders (preventive/corrective)
- **`purchase_orders`** (71 records) - Purchase orders for parts/services
- **`incident_history`** (285 records) - Incident tracking and resolution
- **`service_orders`** (54 records) - Completed service records
- **`maintenance_plans`** (449 records) - Asset maintenance scheduling
- **`profiles`** (55 records) - User profiles and roles
- **`notifications`** (7,023 records) - Existing notification system

#### Key Relationships
```
assets → checklist_schedules → completed_checklists → checklist_issues → work_orders → purchase_orders → service_orders
        ↓                                                ↓
    maintenance_plans                                incident_history
        ↓                                                ↓
    maintenance_history                              maintenance_history
```

## Email Notification Structure

### Target Recipient
**Primary**: `juan.aguirre@dssolutions-mx.com` (Owner - micromanagement oversight)

### Email Schedule

| **Email Type** | **Schedule** | **Time** | **Purpose** |
|---------------|--------------|----------|-------------|
| Morning Checklist Report | Daily | 6:00 AM | Review scheduled activities, identify system errors |
| Evening Checklist Report | Daily | 9:00 PM | Completion feedback and daily performance |
| Work Order + Incidents Report | Daily | 9:00 PM | Combined WO and incident status |
| Maintenance Alerts | Mon/Wed/Fri | 6:00 AM | Upcoming/overdue maintenance alerts |

### Email Content Structure

#### 1. Morning Checklist Report (6:00 AM)
**Subject**: `Checklist Programados - [Date] - Dashboard de Mantenimiento`

**Content Sections**:
- **Executive Summary**: Total scheduled vs system capacity
- **Today's Schedule**: Asset-by-asset breakdown
  - Asset name, operator, checklist type, estimated duration
  - Plant/department assignment
  - Priority level and special requirements
- **System Health Check**: 
  - Schedules without assigned technicians
  - Assets with overdue previous checklists
  - Template versioning inconsistencies
- **Resource Allocation**: Technician workload distribution
- **Potential Issues**: Equipment status conflicts, scheduling overlaps

#### 2. Evening Checklist Report (9:00 PM) 
**Subject**: `Resumen Checklists Completados - [Date] - Dashboard de Mantenimiento`

**Content Sections**:
- **Completion Summary**: Scheduled vs completed percentages
- **Performance Metrics**: 
  - Completion rate by technician
  - Average completion time vs estimated
  - Quality metrics (issues found per checklist)
- **Issues Identified**: 
  - Critical failures requiring immediate work orders
  - Flag items requiring monitoring
  - Recurring issues by asset/component
- **Work Orders Generated**: Automatic WO creation from checklist issues
- **Outstanding Items**: Incomplete checklists with assigned follow-up

#### 3. Work Order + Incidents Report (9:00 PM)
**Subject**: `Órdenes de Trabajo y Incidentes - [Date] - Dashboard de Mantenimiento`

**Content Sections**:
- **Work Order Status**:
  - New work orders created (source: preventive schedule vs corrective issues)
  - In-progress work orders with completion estimates
  - Completed work orders with cost analysis
  - Overdue work orders with escalation recommendations
- **Purchase Order Integration**:
  - POs pending approval by work order
  - Parts delivery status affecting WO execution
  - Cost overruns requiring attention
- **Incident Management**:
  - New incidents reported
  - Incident → Work Order conversion tracking  
  - Resolution times and impact analysis
  - Recurring incidents requiring systematic fixes
- **Resource Utilization**: Technician allocation and productivity

#### 4. Maintenance Alerts (Mon/Wed/Fri 6:00 AM)
**Subject**: `Alertas de Mantenimiento - [Date] - Dashboard de Mantenimiento`

**Content Sections**:
- **Upcoming Maintenance** (Next 14 days):
  - Asset-by-asset maintenance due dates
  - Hours/kilometers remaining calculation (8-hour workday basis)
  - Resource requirements and scheduling recommendations
- **Overdue Maintenance** (Critical):
  - Assets past due maintenance with risk assessment
  - Days/hours overdue with escalation levels
  - Business impact analysis for continued operation
- **Maintenance Planning**:
  - Weekly maintenance capacity vs requirements
  - Parts availability for scheduled maintenance  
  - Technician skill requirements vs availability

## Database Queries for Email Data

### Morning Checklist Query
```sql
-- Daily scheduled checklists with asset and technician details
CREATE OR REPLACE FUNCTION get_daily_checklist_morning_report(target_date DATE)
RETURNS TABLE (
  schedule_id UUID,
  asset_name TEXT,
  asset_id TEXT,
  checklist_name TEXT,
  assigned_technician TEXT,
  scheduled_time TIMESTAMPTZ,
  status TEXT,
  plant_name TEXT,
  department_name TEXT,
  estimated_duration FLOAT,
  last_completion_date TIMESTAMPTZ,
  technician_workload INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id as schedule_id,
    a.name as asset_name,
    a.asset_id as asset_id,
    c.name as checklist_name,
    COALESCE(p.nombre || ' ' || p.apellido, 'No asignado') as assigned_technician,
    cs.scheduled_date as scheduled_time,
    cs.status,
    pl.name as plant_name,
    d.name as department_name,
    mi.estimated_duration,
    (
      SELECT MAX(completion_date) 
      FROM completed_checklists cc2 
      WHERE cc2.asset_id = a.id AND cc2.checklist_id = c.id
    ) as last_completion_date,
    (
      SELECT COUNT(*)::INTEGER 
      FROM checklist_schedules cs2 
      WHERE cs2.assigned_to = cs.assigned_to 
      AND DATE(cs2.scheduled_date) = target_date
    ) as technician_workload
  FROM checklist_schedules cs
  LEFT JOIN assets a ON cs.asset_id = a.id
  LEFT JOIN checklists c ON cs.template_id = c.id
  LEFT JOIN profiles p ON cs.assigned_to = p.id
  LEFT JOIN plants pl ON a.plant_id = pl.id
  LEFT JOIN departments d ON a.department_id = d.id
  LEFT JOIN maintenance_intervals mi ON c.interval_id = mi.id
  WHERE DATE(cs.scheduled_date) = target_date
  ORDER BY cs.scheduled_date, a.name;
END;
$$ LANGUAGE plpgsql;
```

### Evening Checklist Completion Query
```sql
-- Daily checklist completion analysis
CREATE OR REPLACE FUNCTION get_daily_checklist_evening_report(target_date DATE)
RETURNS TABLE (
  total_scheduled INTEGER,
  total_completed INTEGER,
  completion_rate DECIMAL,
  issues_found INTEGER,
  work_orders_generated INTEGER,
  avg_completion_time INTERVAL,
  technician_performance JSONB
) AS $$
DECLARE
  result_record RECORD;
BEGIN
  -- Calculate completion metrics
  SELECT 
    COUNT(cs.id)::INTEGER as scheduled_count,
    COUNT(cc.id)::INTEGER as completed_count,
    CASE WHEN COUNT(cs.id) > 0 
         THEN ROUND(COUNT(cc.id)::DECIMAL / COUNT(cs.id) * 100, 2)
         ELSE 0 
    END as completion_percentage,
    COUNT(ci.id)::INTEGER as total_issues,
    COUNT(DISTINCT wo.id)::INTEGER as work_orders_created,
    AVG(
      EXTRACT(EPOCH FROM (cc.completion_date - cs.scheduled_date)) / 3600
    )::INTERVAL as avg_hours
  INTO result_record
  FROM checklist_schedules cs
  LEFT JOIN completed_checklists cc ON cs.template_id = cc.checklist_id 
                                   AND cs.asset_id = cc.asset_id
                                   AND DATE(cc.completion_date) = target_date
  LEFT JOIN checklist_issues ci ON cc.id = ci.checklist_id
  LEFT JOIN work_orders wo ON ci.work_order_id = wo.id 
                          AND DATE(wo.created_at) = target_date
  WHERE DATE(cs.scheduled_date) = target_date;

  -- Return results
  RETURN QUERY 
  SELECT 
    result_record.scheduled_count,
    result_record.completed_count, 
    result_record.completion_percentage,
    result_record.total_issues,
    result_record.work_orders_created,
    result_record.avg_hours,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'technician', p.nombre || ' ' || p.apellido,
          'scheduled', COUNT(cs.id),
          'completed', COUNT(cc.id),
          'completion_rate', 
            CASE WHEN COUNT(cs.id) > 0 
                 THEN ROUND(COUNT(cc.id)::DECIMAL / COUNT(cs.id) * 100, 2)
                 ELSE 0 
            END
        )
      )
      FROM checklist_schedules cs
      LEFT JOIN profiles p ON cs.assigned_to = p.id
      LEFT JOIN completed_checklists cc ON cs.template_id = cc.checklist_id 
                                       AND cs.asset_id = cc.asset_id
                                       AND DATE(cc.completion_date) = target_date
      WHERE DATE(cs.scheduled_date) = target_date
        AND cs.assigned_to IS NOT NULL
      GROUP BY p.id, p.nombre, p.apellido
    ) as technician_stats;
END;
$$ LANGUAGE plpgsql;
```

### Maintenance Alerts Query
```sql
-- Maintenance due calculation with 8-hour workday consideration
CREATE OR REPLACE FUNCTION get_maintenance_alerts_report()
RETURNS TABLE (
  asset_id UUID,
  asset_name TEXT,
  asset_code TEXT,
  plant_name TEXT,
  maintenance_type TEXT,
  days_until_due INTEGER,
  hours_until_due INTEGER,
  kilometers_until_due INTEGER,
  maintenance_unit TEXT,
  risk_level TEXT,
  last_completed TIMESTAMPTZ,
  estimated_duration FLOAT,
  required_parts JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as asset_id,
    a.name as asset_name,
    a.asset_id as asset_code,
    pl.name as plant_name,
    mp.name as maintenance_type,
    CASE 
      WHEN mp.next_due IS NOT NULL 
      THEN EXTRACT(DAY FROM mp.next_due - CURRENT_DATE)::INTEGER
      ELSE NULL
    END as days_until_due,
    CASE 
      WHEN em.maintenance_unit = 'hours' AND mp.next_due IS NOT NULL
      THEN GREATEST(0, (mp.interval_value - (a.current_hours - COALESCE(
        (SELECT hours FROM maintenance_history mh 
         WHERE mh.asset_id = a.id AND mh.maintenance_plan_id = mp.id
         ORDER BY mh.date DESC LIMIT 1), 
        a.initial_hours))))
      ELSE NULL
    END as hours_until_due,
    CASE 
      WHEN em.maintenance_unit = 'kilometers' AND mp.next_due IS NOT NULL
      THEN GREATEST(0, (mp.interval_value - (a.current_kilometers - COALESCE(
        (SELECT kilometers FROM maintenance_history mh 
         WHERE mh.asset_id = a.id AND mh.maintenance_plan_id = mp.id
         ORDER BY mh.date DESC LIMIT 1), 
        a.initial_kilometers))))
      ELSE NULL
    END as kilometers_until_due,
    em.maintenance_unit,
    CASE 
      WHEN mp.next_due < CURRENT_DATE THEN 'OVERDUE'
      WHEN mp.next_due <= (CURRENT_DATE + INTERVAL '7 days') THEN 'CRITICAL' 
      WHEN mp.next_due <= (CURRENT_DATE + INTERVAL '14 days') THEN 'WARNING'
      ELSE 'NORMAL'
    END as risk_level,
    mp.last_completed,
    mi.estimated_duration,
    mi.type::JSONB as required_parts -- Simplified - would need proper parts relationship
  FROM maintenance_plans mp
  JOIN assets a ON mp.asset_id = a.id
  JOIN equipment_models em ON a.model_id = em.id  
  JOIN maintenance_intervals mi ON mp.interval_id = mi.id
  LEFT JOIN plants pl ON a.plant_id = pl.id
  WHERE 
    mp.status = 'Programado' 
    AND a.status = 'operational'
    AND (
      mp.next_due <= (CURRENT_DATE + INTERVAL '30 days') -- Upcoming maintenance
      OR mp.next_due < CURRENT_DATE -- Overdue maintenance
    )
  ORDER BY 
    CASE 
      WHEN mp.next_due < CURRENT_DATE THEN 1 -- Overdue first
      ELSE 2 
    END,
    mp.next_due ASC;
END;
$$ LANGUAGE plpgsql;
```

## Edge Functions Implementation

### File Structure
```
supabase/functions/
├── maintenance-checklist-morning-report/
│   └── index.ts
├── maintenance-checklist-evening-report/  
│   └── index.ts
├── maintenance-work-orders-report/
│   └── index.ts
└── maintenance-alerts-schedule/
    └── index.ts
```

### Sample Edge Function Structure
Based on the cotizador project patterns:

```typescript
// supabase/functions/maintenance-checklist-morning-report/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!

const FROM_EMAIL = "juan.aguirre@dssolutions-mx.com"
const FROM_NAME = "DASHBOARD DE MANTENIMIENTO"
const RECIPIENT_EMAIL = "juan.aguirre@dssolutions-mx.com"

// Mexico timezone helper functions
const TIMEZONE_OFFSET = -6 * 60 * 60 * 1000
function getMexicoDate(date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000
  return new Date(utc + TIMEZONE_OFFSET)
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Get target date or use today
    const url = new URL(req.url)
    const dateParam = url.searchParams.get('date')
    const targetDate = dateParam || formatDateForDB(getMexicoDate())
    
    // Execute morning report query
    const { data: reportData, error } = await supabase
      .rpc('get_daily_checklist_morning_report', { target_date: targetDate })
    
    if (error) {
      console.error('Query error:', error)
      return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }

    // Generate email content (similar structure to cotizador examples)
    const emailContent = buildMorningReportEmail(reportData, targetDate)
    
    // Send email via SendGrid
    const emailData = {
      personalizations: [{ to: [{ email: RECIPIENT_EMAIL }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: `Checklist Programados - ${targetDate} - Dashboard de Mantenimiento`,
      content: [{ type: "text/html", value: emailContent }]
    }
    
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailData)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('SendGrid error:', errorText)
      return new Response(JSON.stringify({ error: 'Email send failed' }), { status: 500 })
    }

    // Log notification
    await supabase.from('notifications').insert({
      user_id: null,
      title: 'Morning Checklist Report Sent',
      message: `Report sent for ${targetDate}`,
      type: 'MORNING_CHECKLIST_REPORT',
      related_entity: 'system',
      priority: 'medium'
    })

    return new Response(JSON.stringify({
      success: true,
      message: `Morning checklist report sent for ${targetDate}`,
      schedules_count: reportData.length
    }), {
      headers: { "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
```

## Email Template Design

### Visual Design Principles
- **Clean, Professional Layout**: Similar to cotizador project styling
- **Color Coding**: 
  - 🟢 Green: Completed/On-time items
  - 🟡 Yellow: Warning/Pending items  
  - 🔴 Red: Critical/Overdue items
  - 🔵 Blue: Information/System status
- **Mobile Responsive**: Optimized for mobile viewing
- **Data Hierarchy**: Critical information prominent, details expandable

### Template Structure
```html
<!-- Following cotizador email template patterns -->
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de Mantenimiento</title>
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #F8FAFC; color: #334155;">
  <div style="max-width: 800px; margin: 0 auto; background-color: #FFFFFF;">
    <!-- Header -->
    <div style="background-color: #0C4A6E; padding: 30px; text-align: center;">
      <h1 style="color: #FFFFFF; margin: 0; font-size: 24px;">Dashboard de Mantenimiento</h1>
      <p style="color: #BAE6FD; margin: 10px 0 0 0;">{{report_type}} - {{date}}</p>
    </div>
    
    <!-- Executive Summary -->
    <div style="padding: 20px; background-color: #F0F9FF; border-left: 4px solid #0369A1;">
      <h2 style="color: #0C4A6E; margin: 0 0 15px 0;">Resumen Ejecutivo</h2>
      <!-- Key metrics and alerts -->
    </div>
    
    <!-- Detailed Content Sections -->
    <!-- Following the content structure defined above -->
    
    <!-- Footer -->
    <div style="background-color: #F1F5F9; padding: 20px; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: #64748B;">
        © 2025 Dashboard de Mantenimiento. Sistema de Gestión de Mantenimiento.
      </p>
    </div>
  </div>
</body>
</html>
```

## Scheduling Implementation

### Using Supabase Edge Functions with Cron
Based on cotizador patterns, schedule using external cron services:

```bash
# Morning Reports (6:00 AM Mexico Time = 12:00 PM UTC)
0 12 * * * curl -X POST "https://txapndpstzcspgxlybll.supabase.co/functions/v1/maintenance-checklist-morning-report"

# Evening Reports (9:00 PM Mexico Time = 3:00 AM UTC+1)  
0 3 * * * curl -X POST "https://txapndpstzcspgxlybll.supabase.co/functions/v1/maintenance-checklist-evening-report"
0 3 * * * curl -X POST "https://txapndpstzcspgxlybll.supabase.co/functions/v1/maintenance-work-orders-report"

# Maintenance Alerts (6:00 AM Mexico Time, Mon/Wed/Fri)
0 12 * * 1,3,5 curl -X POST "https://txapndpstzcspgxlybll.supabase.co/functions/v1/maintenance-alerts-schedule"
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create database functions for data aggregation
- [ ] Implement morning checklist report edge function
- [ ] Set up SendGrid email templates
- [ ] Test with manual triggers

### Phase 2: Core Reports (Week 2) 
- [ ] Evening checklist completion report
- [ ] Work orders + incidents combined report
- [ ] Email template refinement and mobile optimization

### Phase 3: Maintenance Alerts (Week 3)
- [ ] Maintenance scheduling alerts system
- [ ] Hour/kilometer calculation logic with 8-hour workday
- [ ] Risk assessment and escalation logic

### Phase 4: Production Deployment (Week 4)
- [ ] Cron job configuration for automated scheduling
- [ ] Monitoring and error handling
- [ ] Performance optimization and testing
- [ ] Documentation and handover

## Monitoring and Maintenance

### Error Handling
- **Database Query Failures**: Fallback to simplified queries
- **Email Send Failures**: Log to notifications table with retry logic  
- **Data Inconsistencies**: Flag for manual review in email content

### Performance Monitoring
- **Query Execution Times**: Monitor database function performance
- **Email Delivery Rates**: Track SendGrid success/failure rates
- **System Load**: Monitor Edge Function execution times

### Success Metrics
- **Email Delivery Success Rate**: >99%
- **Data Accuracy**: Cross-reference with manual audits
- **Response Time**: Email generation <30 seconds
- **User Satisfaction**: Feedback on email content usefulness

## Security Considerations

### Data Protection
- **Email Content**: No sensitive personal data in email content
- **Access Control**: Edge functions use service role key with minimal privileges
- **Audit Trail**: All email sends logged to notifications table

### Authentication & Authorization  
- **Single Recipient**: Reduced risk with only owner receiving emails
- **Email Validation**: Verify recipient email before sending
- **Rate Limiting**: Prevent spam/abuse of Edge Functions

## Cost Analysis

### Supabase Edge Functions
- **Function Invocations**: ~120/month (4 daily + 12 weekly alerts)
- **Estimated Cost**: <$5/month for execution time

### SendGrid Email Service
- **Email Volume**: ~120 emails/month  
- **Estimated Cost**: <$10/month (well within free tier)

### Database Queries
- **RPC Executions**: Included in Supabase plan
- **Data Transfer**: Minimal impact

**Total Estimated Monthly Cost**: <$15/month

---

*This implementation provides comprehensive maintenance oversight through automated email reporting, addressing organizational gaps and enabling data-driven maintenance management decisions.*
