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
      assets: {
        Row: {
          asset_id: string
          created_at: string | null
          created_by: string | null
          current_hours: number | null
          current_kilometers: number | null
          department: string | null
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
            foreignKeyName: "assets_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
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
          incident_id: string | null
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
          incident_id?: string | null
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
          incident_id?: string | null
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
            referencedRelation: "completed_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_issues_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incident_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_issues_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_issues_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_with_checklist_status"
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
      checklist_template_versions: {
        Row: {
          change_summary: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          frequency: string | null
          hours_interval: number | null
          id: string
          is_active: boolean | null
          migration_notes: string | null
          model_id: string | null
          name: string
          sections: Json
          template_id: string | null
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          frequency?: string | null
          hours_interval?: number | null
          id?: string
          is_active?: boolean | null
          migration_notes?: string | null
          model_id?: string | null
          name: string
          sections: Json
          template_id?: string | null
          version_number: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          frequency?: string | null
          hours_interval?: number | null
          id?: string
          is_active?: boolean | null
          migration_notes?: string | null
          model_id?: string | null
          name?: string
          sections?: Json
          template_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_versions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_versions_template_id_fkey"
            columns: ["template_id"]
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
          template_version_id: string | null
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
          template_version_id?: string | null
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
          template_version_id?: string | null
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
          {
            foreignKeyName: "completed_checklists_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      // ... existing code ... (rest of tables remain the same)
    }
    Views: {
      // ... existing code ... (views remain the same)
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
      create_incident_from_checklist_issue: {
        Args: { p_checklist_issue_id: string }
        Returns: string
      }
      create_template_version: {
        Args: {
          p_template_id: string
          p_change_summary?: string
          p_migration_notes?: string
        }
        Returns: string
      }
      generate_adjustment_purchase_order: {
        Args: {
          p_work_order_id: string
          p_supplier: string
          p_items: Json
          p_requested_by: string
          p_original_po_id?: string
        }
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
      generate_corrective_work_order_enhanced: {
        Args: { p_checklist_id: string }
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
        Args: { p_asset_id: string; p_maintenance_plan_id: string }
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
      generate_work_order_from_incident: {
        Args: { p_incident_id: string; p_priority?: string }
        Returns: string
      }
      get_active_template_version: {
        Args: { p_template_id: string }
        Returns: string
      }
      get_maintenance_intervals_with_tasks: {
        Args: { p_model_id: string }
        Returns: Json
      }
      get_required_checklist_for_work_order: {
        Args: { p_work_order_id: string }
        Returns: string
      }
      is_work_order_ready_to_execute: {
        Args: { p_work_order_id: string }
        Returns: boolean
      }
      mark_checklist_as_completed: {
        Args: {
          p_schedule_id: string
          p_completed_items: Json
          p_technician: string
          p_notes?: string
          p_signature_data?: string
        }
        Returns: Json
      }
      mark_checklist_as_completed_versioned: {
        Args: {
          p_schedule_id: string
          p_completed_items: Json
          p_technician: string
          p_notes?: string
          p_signature_data?: string
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
      restore_template_version: {
        Args: { p_version_id: string }
        Returns: boolean
      }
      should_allow_purchase_order_generation: {
        Args: { p_work_order_id: string }
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

// ... existing code ... (rest of type definitions remain the same) 