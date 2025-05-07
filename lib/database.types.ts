export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      equipment_models: {
        Row: {
          id: string
          model_id: string
          name: string
          manufacturer: string
          category: string
          description: string | null
          year_introduced: number | null
          expected_lifespan: number | null
          specifications: Json | null
          maintenance_unit: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          model_id?: string
          name: string
          manufacturer: string
          category: string
          description?: string | null
          year_introduced?: number | null
          expected_lifespan?: number | null
          specifications?: Json | null
          maintenance_unit?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          model_id?: string
          name?: string
          manufacturer?: string
          category?: string
          description?: string | null
          year_introduced?: number | null
          expected_lifespan?: number | null
          specifications?: Json | null
          maintenance_unit?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_models_id_fkey"
            columns: ["id"]
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          }
        ]
      }
      maintenance_intervals: {
        Row: {
          id: string
          model_id: string | null
          interval_value: number
          name: string
          description: string | null
          type: string
          estimated_duration: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          model_id?: string | null
          interval_value: number
          name: string
          description?: string | null
          type: string
          estimated_duration?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          model_id?: string | null
          interval_value?: number
          name?: string
          description?: string | null
          type?: string
          estimated_duration?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_intervals_model_id_fkey"
            columns: ["model_id"]
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          }
        ]
      }
      maintenance_tasks: {
        Row: {
          id: string
          interval_id: string | null
          description: string
          type: string
          estimated_time: number | null
          requires_specialist: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          interval_id?: string | null
          description: string
          type: string
          estimated_time?: number | null
          requires_specialist?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          interval_id?: string | null
          description?: string
          type?: string
          estimated_time?: number | null
          requires_specialist?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_interval_id_fkey"
            columns: ["interval_id"]
            referencedRelation: "maintenance_intervals"
            referencedColumns: ["id"]
          }
        ]
      }
      task_parts: {
        Row: {
          id: string
          task_id: string | null
          name: string
          part_number: string | null
          quantity: number
          cost: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          task_id?: string | null
          name: string
          part_number?: string | null
          quantity?: number
          cost?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          task_id?: string | null
          name?: string
          part_number?: string | null
          quantity?: number
          cost?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_parts_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          }
        ]
      }
      model_documentation: {
        Row: {
          id: string
          model_id: string | null
          name: string
          type: string
          file_url: string
          size: string | null
          uploaded_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          model_id?: string | null
          name: string
          type: string
          file_url: string
          size?: string | null
          uploaded_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          model_id?: string | null
          name?: string
          type?: string
          file_url?: string
          size?: string | null
          uploaded_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_documentation_model_id_fkey"
            columns: ["model_id"]
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          }
        ]
      }
      assets: {
        Row: {
          id: string
          asset_id: string
          name: string
          model_id: string | null
          serial_number: string | null
          location: string | null
          department: string | null
          purchase_date: string | null
          installation_date: string | null
          initial_hours: number | null
          current_hours: number | null
          initial_kilometers: number | null
          current_kilometers: number | null
          status: string | null
          notes: string | null
          warranty_expiration: string | null
          is_new: boolean | null
          purchase_cost: string | null
          registration_info: string | null
          insurance_policy: string | null
          insurance_start_date: string | null
          insurance_end_date: string | null
          photos: string[] | null
          insurance_documents: string[] | null
          last_maintenance_date: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          asset_id?: string
          name: string
          model_id?: string | null
          serial_number?: string | null
          location?: string | null
          department?: string | null
          purchase_date?: string | null
          installation_date?: string | null
          initial_hours?: number | null
          current_hours?: number | null
          initial_kilometers?: number | null
          current_kilometers?: number | null
          status?: string | null
          notes?: string | null
          warranty_expiration?: string | null
          is_new?: boolean | null
          purchase_cost?: string | null
          registration_info?: string | null
          insurance_policy?: string | null
          insurance_start_date?: string | null
          insurance_end_date?: string | null
          photos?: string[] | null
          insurance_documents?: string[] | null
          last_maintenance_date?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          asset_id?: string
          name?: string
          model_id?: string | null
          serial_number?: string | null
          location?: string | null
          department?: string | null
          purchase_date?: string | null
          installation_date?: string | null
          initial_hours?: number | null
          current_hours?: number | null
          initial_kilometers?: number | null
          current_kilometers?: number | null
          status?: string | null
          notes?: string | null
          warranty_expiration?: string | null
          is_new?: boolean | null
          purchase_cost?: string | null
          registration_info?: string | null
          insurance_policy?: string | null
          insurance_start_date?: string | null
          insurance_end_date?: string | null
          photos?: string[] | null
          insurance_documents?: string[] | null
          last_maintenance_date?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_model_id_fkey"
            columns: ["model_id"]
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          }
        ]
      }
      maintenance_history: {
        Row: {
          id: string
          asset_id: string | null
          date: string
          type: string
          hours: number | null
          kilometers: number | null
          description: string
          findings: string | null
          actions: string | null
          technician: string
          labor_hours: number | null
          labor_cost: string | null
          parts: Json | null
          total_cost: string | null
          work_order: string | null
          maintenance_plan_id: string | null
          completed_tasks: Json | null
          documents: string[] | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id?: string | null
          date: string
          type: string
          hours?: number | null
          kilometers?: number | null
          description: string
          findings?: string | null
          actions?: string | null
          technician: string
          labor_hours?: number | null
          labor_cost?: string | null
          parts?: Json | null
          total_cost?: string | null
          work_order?: string | null
          maintenance_plan_id?: string | null
          completed_tasks?: Json | null
          documents?: string[] | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string | null
          date?: string
          type?: string
          hours?: number | null
          kilometers?: number | null
          description?: string
          findings?: string | null
          actions?: string | null
          technician?: string
          labor_hours?: number | null
          labor_cost?: string | null
          parts?: Json | null
          total_cost?: string | null
          work_order?: string | null
          maintenance_plan_id?: string | null
          completed_tasks?: Json | null
          documents?: string[] | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_history_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          }
        ]
      }
      incident_history: {
        Row: {
          id: string
          asset_id: string | null
          date: string
          type: string
          reported_by: string
          description: string
          impact: string | null
          resolution: string | null
          downtime: number | null
          labor_hours: number | null
          labor_cost: string | null
          parts: Json | null
          total_cost: string | null
          work_order: string | null
          status: string | null
          documents: string[] | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id?: string | null
          date: string
          type: string
          reported_by: string
          description: string
          impact?: string | null
          resolution?: string | null
          downtime?: number | null
          labor_hours?: number | null
          labor_cost?: string | null
          parts?: Json | null
          total_cost?: string | null
          work_order?: string | null
          status?: string | null
          documents?: string[] | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string | null
          date?: string
          type?: string
          reported_by?: string
          description?: string
          impact?: string | null
          resolution?: string | null
          downtime?: number | null
          labor_hours?: number | null
          labor_cost?: string | null
          parts?: Json | null
          total_cost?: string | null
          work_order?: string | null
          status?: string | null
          documents?: string[] | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_history_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          }
        ]
      }
      maintenance_plans: {
        Row: {
          id: string
          asset_id: string | null
          interval_id: string | null
          interval_value: number
          name: string
          description: string | null
          last_completed: string | null
          next_due: string | null
          status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id?: string | null
          interval_id?: string | null
          interval_value: number
          name: string
          description?: string | null
          last_completed?: string | null
          next_due?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string | null
          interval_id?: string | null
          interval_value?: number
          name?: string
          description?: string | null
          last_completed?: string | null
          next_due?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_plans_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_plans_interval_id_fkey"
            columns: ["interval_id"]
            referencedRelation: "maintenance_intervals"
            referencedColumns: ["id"]
          }
        ]
      }
      checklists: {
        Row: {
          id: string
          name: string
          model_id: string | null
          interval_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          model_id?: string | null
          interval_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          model_id?: string | null
          interval_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_model_id_fkey"
            columns: ["model_id"]
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklists_interval_id_fkey"
            columns: ["interval_id"]
            referencedRelation: "maintenance_intervals"
            referencedColumns: ["id"]
          }
        ]
      }
      checklist_sections: {
        Row: {
          id: string
          checklist_id: string | null
          title: string
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          checklist_id?: string | null
          title: string
          order_index: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          checklist_id?: string | null
          title?: string
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_sections_checklist_id_fkey"
            columns: ["checklist_id"]
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          }
        ]
      }
      checklist_items: {
        Row: {
          id: string
          section_id: string | null
          description: string
          required: boolean | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          section_id?: string | null
          description: string
          required?: boolean | null
          order_index: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          section_id?: string | null
          description?: string
          required?: boolean | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_section_id_fkey"
            columns: ["section_id"]
            referencedRelation: "checklist_sections"
            referencedColumns: ["id"]
          }
        ]
      }
      completed_checklists: {
        Row: {
          id: string
          checklist_id: string | null
          asset_id: string | null
          completed_items: Json
          technician: string
          completion_date: string
          notes: string | null
          status: string | null
          service_order_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          checklist_id?: string | null
          asset_id?: string | null
          completed_items: Json
          technician: string
          completion_date: string
          notes?: string | null
          status?: string | null
          service_order_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          checklist_id?: string | null
          asset_id?: string | null
          completed_items?: Json
          technician?: string
          completion_date?: string
          notes?: string | null
          status?: string | null
          service_order_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "completed_checklists_checklist_id_fkey"
            columns: ["checklist_id"]
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completed_checklists_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          }
        ]
      }
      service_orders: {
        Row: {
          id: string
          order_id: string
          asset_id: string | null
          asset_name: string
          type: string
          priority: string | null
          status: string | null
          date: string
          technician: string
          description: string
          notes: string | null
          parts: Json | null
          checklist_id: string | null
          total_cost: string | null
          documents: string[] | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_id?: string
          asset_id?: string | null
          asset_name: string
          type: string
          priority?: string | null
          status?: string | null
          date: string
          technician: string
          description: string
          notes?: string | null
          parts?: Json | null
          checklist_id?: string | null
          total_cost?: string | null
          documents?: string[] | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          asset_id?: string | null
          asset_name?: string
          type?: string
          priority?: string | null
          status?: string | null
          date?: string
          technician?: string
          description?: string
          notes?: string | null
          parts?: Json | null
          checklist_id?: string | null
          total_cost?: string | null
          documents?: string[] | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_asset_id_fkey"
            columns: ["asset_id"]
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_checklist_id_fkey"
            columns: ["checklist_id"]
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          nombre: string | null
          apellido: string | null
          role: string
          telefono: string | null
          avatar_url: string | null
          departamento: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nombre?: string | null
          apellido?: string | null
          role?: string
          telefono?: string | null
          avatar_url?: string | null
          departamento?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string | null
          apellido?: string | null
          role?: string
          telefono?: string | null
          avatar_url?: string | null
          departamento?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_next_maintenance: {
        Args: {
          p_asset_id: string
          p_maintenance_interval: number
        }
        Returns: string
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
          p_labor_cost: string
          p_total_cost: string
          p_measurement_value: number
          p_documents?: string[]
        }
        Returns: string
      }
      generate_maintenance_plans: {
        Args: {
          p_asset_id: string
        }
        Returns: undefined
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
