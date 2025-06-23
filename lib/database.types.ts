export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      assets: {
        Row: {
          id: number
          asset_id: string
          name: string
          serial_number: string
          location: string
          department: string
          purchase_date: string
          installation_date: string | null
          initial_hours: number
          current_hours: number
          status: string
          notes: string | null
          warranty_expiration: string | null
          is_new: boolean
          purchase_cost: string | null
          registration_info: string | null
          insurance_policy: string | null
          insurance_start_date: string | null
          insurance_end_date: string | null
          model_id: string | null
          photos: string[] | null
          insurance_documents: string[] | null
          created_by: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: number
          asset_id: string
          name: string
          serial_number: string
          location: string
          department: string
          purchase_date: string
          installation_date?: string | null
          initial_hours: number
          current_hours: number
          status: string
          notes?: string | null
          warranty_expiration?: string | null
          is_new: boolean
          purchase_cost?: string | null
          registration_info?: string | null
          insurance_policy?: string | null
          insurance_start_date?: string | null
          insurance_end_date?: string | null
          model_id?: string | null
          photos?: string[] | null
          insurance_documents?: string[] | null
          created_by: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: number
          asset_id?: string
          name?: string
          serial_number?: string
          location?: string
          department?: string
          purchase_date?: string
          installation_date?: string | null
          initial_hours?: number
          current_hours?: number
          status?: string
          notes?: string | null
          warranty_expiration?: string | null
          is_new?: boolean
          purchase_cost?: string | null
          registration_info?: string | null
          insurance_policy?: string | null
          insurance_start_date?: string | null
          insurance_end_date?: string | null
          model_id?: string | null
          photos?: string[] | null
          insurance_documents?: string[] | null
          created_by?: string
          created_at?: string
          updated_at?: string | null
        }
      }
      equipment_models: {
        Row: {
          id: string
          name: string
          manufacturer: string
          category: string
          description: string | null
          maintenance_intervals: Json | null
          created_by: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id: string
          name: string
          manufacturer: string
          category: string
          description?: string | null
          maintenance_intervals?: Json | null
          created_by: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          manufacturer?: string
          category?: string
          description?: string | null
          maintenance_intervals?: Json | null
          created_by?: string
          created_at?: string
          updated_at?: string | null
        }
      }
      maintenance_history: {
        Row: {
          id: number
          asset_id: string
          date: string
          type: string
          description: string
          technician: string
          cost: string | null
          parts: Json | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: number
          asset_id: string
          date: string
          type: string
          description: string
          technician: string
          cost?: string | null
          parts?: Json | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: number
          asset_id?: string
          date?: string
          type?: string
          description?: string
          technician?: string
          cost?: string | null
          parts?: Json | null
          created_by?: string
          created_at?: string
        }
      }
       service_orders: {
        Row: {
          order_id: string
          asset_id: string
          asset_name: string
          type: string
          priority: string
          status: string
          date: string
          technician: string
          description: string
          notes: string | null
          parts: Json | null
          checklist_id: string | null
          total_cost: string | null
          created_at: string
          provider: string | null
          warranty: boolean | null
        }
        Insert: {
          order_id: string
          asset_id: string
          asset_name: string
          type: string
          priority: string
          status: string
          date: string
          technician: string
          description: string
          notes?: string | null
          parts?: Json | null
          checklist_id?: string | null
          total_cost?: string | null
          created_at?: string
          provider?: string | null
          warranty?: boolean | null
        }
        Update: {
          order_id?: string
          asset_id?: string
          asset_name?: string
          type?: string
          priority?: string
          status?: string
          date?: string
          technician?: string
          description?: string
          notes?: string | null
          parts?: Json | null
          checklist_id?: string | null
          total_cost?: string | null
          created_at?: string
          provider?: string | null
          warranty?: boolean | null
        }
      }
      completed_checklists: {
        Row: {
          checklist_id: string
          asset_id: string
          completed_items: Json | null
          technician: string
          completion_date: string
          notes: string | null
          status: string
          service_order_id: string | null
          created_at: string
        }
        Insert: {
          checklist_id: string
          asset_id: string
          completed_items?: Json | null
          technician: string
          completion_date: string
          notes?: string | null
          status: string
          service_order_id?: string | null
          created_at?: string
        }
        Update: {
          checklist_id?: string
          asset_id?: string
          completed_items?: Json | null
          technician?: string
          completion_date?: string
          notes?: string | null
          status?: string
          service_order_id?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
