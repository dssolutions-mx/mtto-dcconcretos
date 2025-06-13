export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      additional_expenses: {
        Row: {
          adjustment_po_id: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          asset_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          justification: string
          processed: boolean | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          updated_at: string | null
          updated_by: string | null
          work_order_id: string | null
        }
        Insert: {
          adjustment_po_id?: string | null
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          asset_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          justification: string
          processed?: boolean | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          adjustment_po_id?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          asset_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          justification?: string
          processed?: boolean | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "additional_expenses_adjustment_po_id_fkey"
            columns: ["adjustment_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_expenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_expenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_expenses_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_expenses_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_with_checklist_status"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_operators: {
        Row: {
          asset_id: string
          assigned_by: string | null
          assignment_type: string
          created_at: string | null
          created_by: string | null
          end_date: string | null
          id: string
          notes: string | null
          operator_id: string
          start_date: string
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          asset_id: string
          assigned_by?: string | null
          assignment_type?: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          operator_id: string
          start_date?: string
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          asset_id?: string
          assigned_by?: string | null
          assignment_type?: string
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          operator_id?: string
          start_date?: string
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_operators_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_operators_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_operators_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_operators_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_operators_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_operators_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_operators_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_operators_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_id: string
          created_at: string | null
          created_by: string | null
          current_hours: number | null
          current_kilometers: number | null
          department: string | null
          department_id: string | null
          id: string
          initial_hours: number | null
          initial_kilometers: number | null
          installation_date: string | null
          insurance_documents: string[] | null
          insurance_end_date: string | null
          insurance_policy: string | null
          insurance_start_date: string | null
          is_new: boolean | null
          last_inspection_date: string | null
          last_maintenance_date: string | null
          location: string | null
          model_id: string | null
          name: string
          notes: string | null
          photos: string[] | null
          plant_id: string | null
          purchase_cost: number | null
          purchase_date: string | null
          registration_info: string | null
          serial_number: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
          warranty_expiration: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          created_by?: string | null
          current_hours?: number | null
          current_kilometers?: number | null
          department?: string | null
          department_id?: string | null
          id?: string
          initial_hours?: number | null
          initial_kilometers?: number | null
          installation_date?: string | null
          insurance_documents?: string[] | null
          insurance_end_date?: string | null
          insurance_policy?: string | null
          insurance_start_date?: string | null
          is_new?: boolean | null
          last_inspection_date?: string | null
          last_maintenance_date?: string | null
          location?: string | null
          model_id?: string | null
          name: string
          notes?: string | null
          photos?: string[] | null
          plant_id?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          registration_info?: string | null
          serial_number?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          warranty_expiration?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          created_by?: string | null
          current_hours?: number | null
          current_kilometers?: number | null
          department?: string | null
          department_id?: string | null
          id?: string
          initial_hours?: number | null
          initial_kilometers?: number | null
          installation_date?: string | null
          insurance_documents?: string[] | null
          insurance_end_date?: string | null
          insurance_policy?: string | null
          insurance_start_date?: string | null
          is_new?: boolean | null
          last_inspection_date?: string | null
          last_maintenance_date?: string | null
          location?: string | null
          model_id?: string | null
          name?: string
          notes?: string | null
          photos?: string[] | null
          plant_id?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          registration_info?: string | null
          serial_number?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          warranty_expiration?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          manager_id: string | null
          name: string
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          name: string
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          budget_code: string | null
          code: string
          cost_center: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          plant_id: string
          supervisor_id: string | null
          updated_at: string | null
        }
        Insert: {
          budget_code?: string | null
          code: string
          cost_center?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          plant_id: string
          supervisor_id?: string | null
          updated_at?: string | null
        }
        Update: {
          budget_code?: string | null
          code?: string
          cost_center?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          plant_id?: string
          supervisor_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_models: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          expected_lifespan: number | null
          id: string
          maintenance_unit: string
          manufacturer: string
          model_id: string
          name: string
          specifications: Json | null
          updated_at: string | null
          updated_by: string | null
          year_introduced: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expected_lifespan?: number | null
          id?: string
          maintenance_unit?: string
          manufacturer: string
          model_id: string
          name: string
          specifications?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          year_introduced?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expected_lifespan?: number | null
          id?: string
          maintenance_unit?: string
          manufacturer?: string
          model_id?: string
          name?: string
          specifications?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          year_introduced?: number | null
        }
        Relationships: []
      }
      plants: {
        Row: {
          address: string | null
          business_unit_id: string | null
          code: string
          contact_info: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          location: string | null
          maintenance_supervisor_id: string | null
          name: string
          operating_hours: Json | null
          plant_manager_id: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          business_unit_id?: string | null
          code: string
          contact_info?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          location?: string | null
          maintenance_supervisor_id?: string | null
          name: string
          operating_hours?: Json | null
          plant_manager_id?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          business_unit_id?: string | null
          code?: string
          contact_info?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          location?: string | null
          maintenance_supervisor_id?: string | null
          name?: string
          operating_hours?: Json | null
          plant_manager_id?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plants_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_issues: {
        Row: {
          checklist_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          item_id: string
          notes: string | null
          photo_url: string | null
          resolution_date: string | null
          resolved: boolean | null
          status: string
          updated_at: string | null
          updated_by: string | null
          work_order_id: string | null
        }
        Insert: {
          checklist_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          item_id: string
          notes?: string | null
          photo_url?: string | null
          resolution_date?: string | null
          resolved?: boolean | null
          status: string
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          checklist_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          item_id?: string
          notes?: string | null
          photo_url?: string | null
          resolution_date?: string | null
          resolved?: boolean | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_issues_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_issues_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          expected_value: string | null
          id: string
          item_type: string | null
          order_index: number
          required: boolean | null
          section_id: string | null
          tolerance: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description: string
          expected_value?: string | null
          id?: string
          item_type?: string | null
          order_index: number
          required?: boolean | null
          section_id?: string | null
          tolerance?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          expected_value?: string | null
          id?: string
          item_type?: string | null
          order_index?: number
          required?: boolean | null
          section_id?: string | null
          tolerance?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "checklist_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_schedules: {
        Row: {
          asset_id: string | null
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          id: string
          maintenance_plan_id: string | null
          scheduled_date: string
          status: string | null
          template_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          asset_id?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          maintenance_plan_id?: string | null
          scheduled_date: string
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          asset_id?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          maintenance_plan_id?: string | null
          scheduled_date?: string
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_schedules_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_schedules_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_schedules_maintenance_plan_id_fkey"
            columns: ["maintenance_plan_id"]
            isOneToOne: false
            referencedRelation: "maintenance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_schedules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_sections: {
        Row: {
          checklist_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          order_index: number
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          checklist_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          order_index: number
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          checklist_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          order_index?: number
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_sections_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          frequency: string | null
          hours_interval: number | null
          id: string
          interval_id: string | null
          model_id: string | null
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          frequency?: string | null
          hours_interval?: number | null
          id?: string
          interval_id?: string | null
          model_id?: string | null
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          frequency?: string | null
          hours_interval?: number | null
          id?: string
          interval_id?: string | null
          model_id?: string | null
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklists_interval_id_fkey"
            columns: ["interval_id"]
            isOneToOne: false
            referencedRelation: "maintenance_intervals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
        ]
      }
      completed_checklists: {
        Row: {
          asset_id: string | null
          checklist_id: string | null
          completed_items: Json
          completion_date: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          service_order_id: string | null
          signature_data: string | null
          status: string | null
          technician: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          asset_id?: string | null
          checklist_id?: string | null
          completed_items: Json
          completion_date: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          service_order_id?: string | null
          signature_data?: string | null
          status?: string | null
          technician: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          asset_id?: string | null
          checklist_id?: string | null
          completed_items?: Json
          completion_date?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          service_order_id?: string | null
          signature_data?: string | null
          status?: string | null
          technician?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "completed_checklists_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_checklists_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_checklists_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_history: {
        Row: {
          asset_id: string | null
          checklist_id: string | null
          created_at: string | null
          created_by: string | null
          date: string
          description: string
          documents: string[] | null
          downtime: number | null
          id: string
          impact: string | null
          labor_cost: number | null
          labor_hours: number | null
          parts: Json | null
          reported_by: string
          reported_by_id: string | null
          resolution: string | null
          service_order_id: string | null
          status: string | null
          total_cost: number | null
          type: string
          updated_at: string | null
          updated_by: string | null
          work_order_id: string | null
          work_order_text: string | null
        }
        Insert: {
          asset_id?: string | null
          checklist_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          description: string
          documents?: string[] | null
          downtime?: number | null
          id?: string
          impact?: string | null
          labor_cost?: number | null
          labor_hours?: number | null
          parts?: Json | null
          reported_by: string
          reported_by_id?: string | null
          resolution?: string | null
          service_order_id?: string | null
          status?: string | null
          total_cost?: number | null
          type: string
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
          work_order_text?: string | null
        }
        Update: {
          asset_id?: string | null
          checklist_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string
          documents?: string[] | null
          downtime?: number | null
          id?: string
          impact?: string | null
          labor_cost?: number | null
          labor_hours?: number | null
          parts?: Json | null
          reported_by?: string
          reported_by_id?: string | null
          resolution?: string | null
          service_order_id?: string | null
          status?: string | null
          total_cost?: number | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
          work_order_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_history_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_history_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_history: {
        Row: {
          actions: string | null
          asset_id: string | null
          completed_tasks: Json | null
          created_at: string | null
          created_by: string | null
          date: string
          description: string
          documents: string[] | null
          downtime_hours: number | null
          findings: string | null
          hours: number | null
          id: string
          kilometers: number | null
          labor_cost: number | null
          labor_hours: number | null
          maintenance_plan_id: string | null
          parts: Json | null
          resolution_details: string | null
          service_order_id: string | null
          technician: string
          technician_id: string | null
          technician_notes: string | null
          total_cost: number | null
          type: string
          updated_at: string | null
          updated_by: string | null
          work_order: string | null
          work_order_id: string | null
        }
        Insert: {
          actions?: string | null
          asset_id?: string | null
          completed_tasks?: Json | null
          created_at?: string | null
          created_by?: string | null
          date: string
          description: string
          documents?: string[] | null
          downtime_hours?: number | null
          findings?: string | null
          hours?: number | null
          id?: string
          kilometers?: number | null
          labor_cost?: number | null
          labor_hours?: number | null
          maintenance_plan_id?: string | null
          parts?: Json | null
          resolution_details?: string | null
          service_order_id?: string | null
          technician: string
          technician_id?: string | null
          technician_notes?: string | null
          total_cost?: number | null
          type: string
          updated_at?: string | null
          updated_by?: string | null
          work_order?: string | null
          work_order_id?: string | null
        }
        Update: {
          actions?: string | null
          asset_id?: string | null
          completed_tasks?: Json | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string
          documents?: string[] | null
          downtime_hours?: number | null
          findings?: string | null
          hours?: number | null
          id?: string
          kilometers?: number | null
          labor_cost?: number | null
          labor_hours?: number | null
          maintenance_plan_id?: string | null
          parts?: Json | null
          resolution_details?: string | null
          service_order_id?: string | null
          technician?: string
          technician_id?: string | null
          technician_notes?: string | null
          total_cost?: number | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
          work_order?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_intervals: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          estimated_duration: number | null
          id: string
          interval_value: number
          model_id: string | null
          name: string
          type: string
          updated_at: string | null
          updated_by: string | null
          is_recurring: boolean | null
          is_first_cycle_only: boolean | null
          cycle_defining_interval: number | null
          maintenance_category: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          estimated_duration?: number | null
          id?: string
          interval_value: number
          model_id?: string | null
          name: string
          type: string
          updated_at?: string | null
          updated_by?: string | null
          is_recurring?: boolean | null
          is_first_cycle_only?: boolean | null
          cycle_defining_interval?: number | null
          maintenance_category?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          estimated_duration?: number | null
          id?: string
          interval_value?: number
          model_id?: string | null
          name?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
          is_recurring?: boolean | null
          is_first_cycle_only?: boolean | null
          cycle_defining_interval?: number | null
          maintenance_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_intervals_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_plans: {
        Row: {
          asset_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          interval_id: string | null
          interval_value: number
          last_completed: string | null
          name: string
          next_due: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          interval_id?: string | null
          interval_value: number
          last_completed?: string | null
          name: string
          next_due?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          interval_id?: string | null
          interval_value?: number
          last_completed?: string | null
          name?: string
          next_due?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plans_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_interval_id_fkey"
            columns: ["interval_id"]
            isOneToOne: false
            referencedRelation: "maintenance_intervals"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string
          estimated_time: number | null
          id: string
          interval_id: string | null
          requires_specialist: boolean | null
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description: string
          estimated_time?: number | null
          id?: string
          interval_id?: string | null
          requires_specialist?: boolean | null
          type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string
          estimated_time?: number | null
          id?: string
          interval_id?: string | null
          requires_specialist?: boolean | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_interval_id_fkey"
            columns: ["interval_id"]
            isOneToOne: false
            referencedRelation: "maintenance_intervals"
            referencedColumns: ["id"]
          },
        ]
      }
      model_documentation: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_url: string
          id: string
          model_id: string | null
          name: string
          size: string | null
          type: string
          updated_at: string | null
          updated_by: string | null
          uploaded_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_url: string
          id?: string
          model_id?: string | null
          name: string
          size?: string | null
          type: string
          updated_at?: string | null
          updated_by?: string | null
          uploaded_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_url?: string
          id?: string
          model_id?: string | null
          name?: string
          size?: string | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_documentation_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          entity_id: string | null
          id: string
          message: string
          priority: string | null
          read_at: string | null
          related_entity: string | null
          status: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          id?: string
          message: string
          priority?: string | null
          read_at?: string | null
          related_entity?: string | null
          status?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          id?: string
          message?: string
          priority?: string | null
          read_at?: string | null
          related_entity?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          apellido: string | null
          avatar_url: string | null
          created_at: string
          departamento: string | null
          id: string
          nombre: string | null
          role: Database["public"]["Enums"]["user_role"]
          telefono: string | null
          updated_at: string
        }
        Insert: {
          apellido?: string | null
          avatar_url?: string | null
          created_at?: string
          departamento?: string | null
          id: string
          nombre?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          apellido?: string | null
          avatar_url?: string | null
          created_at?: string
          departamento?: string | null
          id?: string
          nombre?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_receipts: {
        Row: {
          created_at: string | null
          description: string | null
          expense_type: string
          file_url: string
          id: string
          is_adjustment_receipt: boolean | null
          purchase_order_id: string
          receipt_date: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          expense_type?: string
          file_url: string
          id?: string
          is_adjustment_receipt?: boolean | null
          purchase_order_id: string
          receipt_date?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          expense_type?: string
          file_url?: string
          id?: string
          is_adjustment_receipt?: boolean | null
          purchase_order_id?: string
          receipt_date?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          adjusted_at: string | null
          adjusted_by: string | null
          adjusted_total_amount: number | null
          adjustment_amount: number | null
          adjustment_reason: string | null
          adjustment_status: string | null
          approval_date: string | null
          approved_by: string | null
          created_at: string | null
          expected_delivery_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          is_adjustment: boolean | null
          items: Json | null
          notes: string | null
          order_id: string
          original_purchase_order_id: string | null
          payment_status: string | null
          quotation_url: string | null
          receipt_uploaded: boolean | null
          requested_by: string | null
          requires_adjustment: boolean | null
          status: string | null
          supplier: string | null
          total_amount: number | null
          updated_at: string | null
          updated_by: string | null
          work_order_id: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjusted_total_amount?: number | null
          adjustment_amount?: number | null
          adjustment_reason?: string | null
          adjustment_status?: string | null
          approval_date?: string | null
          approved_by?: string | null
          created_at?: string | null
          expected_delivery_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          is_adjustment?: boolean | null
          items?: Json | null
          notes?: string | null
          order_id: string
          original_purchase_order_id?: string | null
          payment_status?: string | null
          quotation_url?: string | null
          receipt_uploaded?: boolean | null
          requested_by?: string | null
          requires_adjustment?: boolean | null
          status?: string | null
          supplier?: string | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjusted_total_amount?: number | null
          adjustment_amount?: number | null
          adjustment_reason?: string | null
          adjustment_status?: string | null
          approval_date?: string | null
          approved_by?: string | null
          created_at?: string | null
          expected_delivery_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          is_adjustment?: boolean | null
          items?: Json | null
          notes?: string | null
          order_id?: string
          original_purchase_order_id?: string | null
          payment_status?: string | null
          quotation_url?: string | null
          receipt_uploaded?: boolean | null
          requested_by?: string | null
          requires_adjustment?: boolean | null
          status?: string | null
          supplier?: string | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_original_purchase_order_id_fkey"
            columns: ["original_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          actions: string | null
          additional_expenses: string | null
          asset_id: string | null
          asset_name: string
          checklist_id: string | null
          completion_date: string | null
          created_at: string | null
          created_by: string | null
          date: string
          description: string
          documents: string[] | null
          findings: string | null
          has_additional_expenses: boolean | null
          id: string
          labor_cost: number | null
          labor_hours: number | null
          notes: string | null
          order_id: string
          parts: Json | null
          parts_cost: number | null
          priority: string | null
          requires_adjustment: boolean | null
          status: string | null
          technician: string
          technician_id: string | null
          total_cost: number | null
          type: string
          updated_at: string | null
          updated_by: string | null
          work_order_id: string | null
        }
        Insert: {
          actions?: string | null
          additional_expenses?: string | null
          asset_id?: string | null
          asset_name: string
          checklist_id?: string | null
          completion_date?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          description: string
          documents?: string[] | null
          findings?: string | null
          has_additional_expenses?: boolean | null
          id?: string
          labor_cost?: number | null
          labor_hours?: number | null
          notes?: string | null
          order_id: string
          parts?: Json | null
          parts_cost?: number | null
          priority?: string | null
          requires_adjustment?: boolean | null
          status?: string | null
          technician: string
          technician_id?: string | null
          total_cost?: number | null
          type: string
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          actions?: string | null
          additional_expenses?: string | null
          asset_id?: string | null
          asset_name?: string
          checklist_id?: string | null
          completion_date?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string
          documents?: string[] | null
          findings?: string | null
          has_additional_expenses?: boolean | null
          id?: string
          labor_cost?: number | null
          labor_hours?: number | null
          notes?: string | null
          order_id?: string
          parts?: Json | null
          parts_cost?: number | null
          priority?: string | null
          requires_adjustment?: boolean | null
          status?: string | null
          technician?: string
          technician_id?: string | null
          total_cost?: number | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      task_parts: {
        Row: {
          cost: number | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          part_number: string | null
          quantity: number
          task_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          part_number?: string | null
          quantity?: number
          task_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          part_number?: string | null
          quantity?: number
          task_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_parts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          approval_date: string | null
          approval_status: string | null
          approved_by: string | null
          asset_id: string | null
          assigned_to: string | null
          checklist_id: string | null
          completed_at: string | null
          completion_photos: Json | null
          created_at: string | null
          creation_photos: Json | null
          description: string
          estimated_cost: number | null
          estimated_duration: number | null
          id: string
          issue_items: Json | null
          maintenance_plan_id: string | null
          order_id: string
          planned_date: string | null
          priority: string | null
          progress_photos: Json | null
          purchase_order_id: string | null
          requested_by: string | null
          required_parts: Json | null
          service_order_id: string | null
          status: string | null
          type: string
          updated_at: string | null
          updated_by: string | null
          used_parts: Json | null
        }
        Insert: {
          approval_date?: string | null
          approval_status?: string | null
          approved_by?: string | null
          asset_id?: string | null
          assigned_to?: string | null
          checklist_id?: string | null
          completed_at?: string | null
          completion_photos?: Json | null
          created_at?: string | null
          creation_photos?: Json | null
          description: string
          estimated_cost?: number | null
          estimated_duration?: number | null
          id?: string
          issue_items?: Json | null
          maintenance_plan_id?: string | null
          order_id: string
          planned_date?: string | null
          priority?: string | null
          progress_photos?: Json | null
          purchase_order_id?: string | null
          requested_by?: string | null
          required_parts?: Json | null
          service_order_id?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
          used_parts?: Json | null
        }
        Update: {
          approval_date?: string | null
          approval_status?: string | null
          approved_by?: string | null
          asset_id?: string | null
          assigned_to?: string | null
          checklist_id?: string | null
          completed_at?: string | null
          completion_photos?: Json | null
          created_at?: string | null
          creation_photos?: Json | null
          description?: string
          estimated_cost?: number | null
          estimated_duration?: number | null
          id?: string
          issue_items?: Json | null
          maintenance_plan_id?: string | null
          order_id?: string
          planned_date?: string | null
          priority?: string | null
          progress_photos?: Json | null
          purchase_order_id?: string | null
          requested_by?: string | null
          required_parts?: Json | null
          service_order_id?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          updated_by?: string | null
          used_parts?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_assets_without_recent_inspection: {
        Row: {
          asset_id: string | null
          created_at: string | null
          created_by: string | null
          current_hours: number | null
          current_kilometers: number | null
          days_since_last_inspection: number | null
          department: string | null
          id: string | null
          initial_hours: number | null
          initial_kilometers: number | null
          installation_date: string | null
          insurance_documents: string[] | null
          insurance_end_date: string | null
          insurance_policy: string | null
          insurance_start_date: string | null
          is_new: boolean | null
          last_inspection: string | null
          last_inspection_date: string | null
          last_maintenance_date: string | null
          location: string | null
          manufacturer: string | null
          model_id: string | null
          model_name: string | null
          name: string | null
          notes: string | null
          photos: string[] | null
          purchase_cost: number | null
          purchase_date: string | null
          registration_info: string | null
          serial_number: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
          warranty_expiration: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_completion_rate: {
        Row: {
          checklist_name: string | null
          completed: number | null
          completion_rate: number | null
          month: string | null
          total_scheduled: number | null
        }
        Relationships: []
      }
      common_checklist_issues: {
        Row: {
          checklist_name: string | null
          issue_count: number | null
          item_description: string | null
          item_id: string | null
          section_title: string | null
        }
        Relationships: []
      }
      pending_expense_approvals: {
        Row: {
          amount: number | null
          asset_id: string | null
          asset_name: string | null
          created_at: string | null
          description: string | null
          id: string | null
          justification: string | null
          purchase_order_id: string | null
          purchase_order_number: string | null
          requested_by: string | null
          status: string | null
          work_order_id: string | null
          work_order_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "additional_expenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_expenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_expenses_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_column_if_not_exists: {
        Args: {
          p_table: string
          p_column: string
          p_type: string
          p_constraint?: string
        }
        Returns: undefined
      }
      approve_additional_expense: {
        Args: { p_expense_id: string; p_approved_by: string }
        Returns: boolean
      }
      approve_purchase_order: {
        Args: { p_purchase_order_id: string; p_approved_by: string }
        Returns: undefined
      }
      auto_approve_additional_expense: {
        Args: { p_expense_id: string; p_approved_by: string }
        Returns: boolean
      }
      calculate_next_maintenance: {
        Args: { p_asset_id: string; p_maintenance_interval: number }
        Returns: string
      }
      check_maintenance_due_assets: {
        Args: Record<PropertyKey, never>
        Returns: {
          asset_id: string
          asset_name: string
          maintenance_plan_id: string
          plan_name: string
          next_due: string
          days_remaining: number
          value_remaining: number
          maintenance_unit: string
        }[]
      }
      complete_maintenance: {
        Args: {
          p_maintenance_id: string
          p_technician: string
          p_completion_date: string
          p_findings: string
          p_actions: string
          p_parts: Json
          p_labor_hours: number
          p_labor_cost: number
          p_total_cost: number
          p_measurement_value: number
          p_documents?: string[]
        }
        Returns: string
      }
      complete_work_order: {
        Args: { p_work_order_id: string; p_completion_data: Json }
        Returns: string
      }
      generate_checklists_from_maintenance_plan: {
        Args: {
          maintenance_plan_id: string
          scheduled_date: string
          assigned_to: string
        }
        Returns: string[]
      }
      generate_corrective_work_order: {
        Args:
          | {
              p_asset_id: string
              p_description: string
              p_requested_by: string
              p_assigned_to: string
              p_planned_date: string
              p_estimated_duration: number
              p_priority: string
              p_checklist_id?: string
            }
          | { p_checklist_id: string }
        Returns: string
      }
      generate_maintenance_plans: {
        Args: { p_asset_id: string }
        Returns: undefined
      }
      generate_next_id: {
        Args: { prefix: string }
        Returns: string
      }
      generate_order_id: {
        Args: { order_type: string }
        Returns: string
      }
      generate_preventive_work_order: {
        Args:
          | {
              p_asset_id: string
              p_description: string
              p_requested_by: string
              p_assigned_to: string
              p_planned_date: string
              p_estimated_duration: number
              p_priority: string
              p_checklist_id?: string
            }
          | { p_asset_id: string; p_maintenance_plan_id: string }
        Returns: string
      }
      generate_purchase_order: {
        Args: {
          p_work_order_id: string
          p_supplier: string
          p_items: Json
          p_requested_by: string
          p_expected_delivery_date: string
          p_quotation_url?: string
        }
        Returns: string
      }
      get_maintenance_intervals_with_tasks: {
        Args: { p_model_id: string }
        Returns: Json
      }
      mark_checklist_as_completed: {
        Args: {
          p_schedule_id: string
          p_completed_items: Json
          p_technician: string
          p_notes?: string
        }
        Returns: Json
      }
      reject_additional_expense: {
        Args: {
          p_expense_id: string
          p_rejected_by: string
          p_rejection_reason: string
        }
        Returns: boolean
      }
      update_maintenance_plan_after_completion: {
        Args: {
          p_asset_id: string
          p_interval_value: number
          p_completion_date: string
        }
        Returns: undefined
      }
    }
    Enums: {
      user_role: "EJECUTIVO" | "JEFE DE PLANTA" | "ENCARGADO DE MANTENIMIENTO"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["EJECUTIVO", "JEFE DE PLANTA", "ENCARGADO DE MANTENIMIENTO"],
    },
  },
} as const
