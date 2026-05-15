export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
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
            referencedRelation: "accounts_payable_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_expenses_adjustment_po_id_fkey"
            columns: ["adjustment_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_expenses_adjustment_po_id_fkey"
            columns: ["adjustment_po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_expense_classification"
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
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
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
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
      app_settings: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          is_sensitive: boolean | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          is_sensitive?: boolean | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          is_sensitive?: boolean | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      asset_accountability_tracking: {
        Row: {
          alert_level: string | null
          asset_id: string
          created_at: string
          days_without_checklist: number | null
          days_without_operator: number | null
          escalation_count: number | null
          has_operator: boolean | null
          has_pending_schedules: boolean | null
          has_recent_checklist: boolean | null
          id: string
          last_checklist_date: string | null
          last_checklist_id: string | null
          last_escalated_at: string | null
          last_notified_at: string | null
          last_updated_at: string
          notification_count: number | null
          oldest_pending_schedule_date: string | null
          pending_schedules_count: number | null
          primary_responsible_user_id: string | null
          secondary_responsible_user_id: string | null
        }
        Insert: {
          alert_level?: string | null
          asset_id: string
          created_at?: string
          days_without_checklist?: number | null
          days_without_operator?: number | null
          escalation_count?: number | null
          has_operator?: boolean | null
          has_pending_schedules?: boolean | null
          has_recent_checklist?: boolean | null
          id?: string
          last_checklist_date?: string | null
          last_checklist_id?: string | null
          last_escalated_at?: string | null
          last_notified_at?: string | null
          last_updated_at?: string
          notification_count?: number | null
          oldest_pending_schedule_date?: string | null
          pending_schedules_count?: number | null
          primary_responsible_user_id?: string | null
          secondary_responsible_user_id?: string | null
        }
        Update: {
          alert_level?: string | null
          asset_id?: string
          created_at?: string
          days_without_checklist?: number | null
          days_without_operator?: number | null
          escalation_count?: number | null
          has_operator?: boolean | null
          has_pending_schedules?: boolean | null
          has_recent_checklist?: boolean | null
          id?: string
          last_checklist_date?: string | null
          last_checklist_id?: string | null
          last_escalated_at?: string | null
          last_notified_at?: string | null
          last_updated_at?: string
          notification_count?: number | null
          oldest_pending_schedule_date?: string | null
          pending_schedules_count?: number | null
          primary_responsible_user_id?: string | null
          secondary_responsible_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_accountability_tracking_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_last_checklist_id_fkey"
            columns: ["last_checklist_id"]
            isOneToOne: false
            referencedRelation: "completed_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_primary_responsible_user_id_fkey"
            columns: ["primary_responsible_user_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_primary_responsible_user_id_fkey"
            columns: ["primary_responsible_user_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_primary_responsible_user_id_fkey"
            columns: ["primary_responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_primary_responsible_user_id_fkey"
            columns: ["primary_responsible_user_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_primary_responsible_user_id_fkey"
            columns: ["primary_responsible_user_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_primary_responsible_user_id_fkey"
            columns: ["primary_responsible_user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_secondary_responsible_user_i_fkey"
            columns: ["secondary_responsible_user_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_secondary_responsible_user_i_fkey"
            columns: ["secondary_responsible_user_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_secondary_responsible_user_i_fkey"
            columns: ["secondary_responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_secondary_responsible_user_i_fkey"
            columns: ["secondary_responsible_user_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_secondary_responsible_user_i_fkey"
            columns: ["secondary_responsible_user_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_accountability_tracking_secondary_responsible_user_i_fkey"
            columns: ["secondary_responsible_user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_assignment_history: {
        Row: {
          asset_id: string
          change_reason: string | null
          changed_by: string
          created_at: string | null
          id: string
          new_plant_id: string | null
          previous_plant_id: string | null
        }
        Insert: {
          asset_id: string
          change_reason?: string | null
          changed_by: string
          created_at?: string | null
          id?: string
          new_plant_id?: string | null
          previous_plant_id?: string | null
        }
        Update: {
          asset_id?: string
          change_reason?: string | null
          changed_by?: string
          created_at?: string | null
          id?: string
          new_plant_id?: string | null
          previous_plant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignment_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignment_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "asset_assignment_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignment_history_new_plant_id_fkey"
            columns: ["new_plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "asset_assignment_history_new_plant_id_fkey"
            columns: ["new_plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "asset_assignment_history_new_plant_id_fkey"
            columns: ["new_plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "asset_assignment_history_new_plant_id_fkey"
            columns: ["new_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignment_history_previous_plant_id_fkey"
            columns: ["previous_plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "asset_assignment_history_previous_plant_id_fkey"
            columns: ["previous_plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "asset_assignment_history_previous_plant_id_fkey"
            columns: ["previous_plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "asset_assignment_history_previous_plant_id_fkey"
            columns: ["previous_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_composite_relationships: {
        Row: {
          attachment_date: string | null
          component_asset_id: string
          composite_asset_id: string
          created_at: string | null
          created_by: string | null
          detachment_date: string | null
          id: string
          status: string | null
        }
        Insert: {
          attachment_date?: string | null
          component_asset_id: string
          composite_asset_id: string
          created_at?: string | null
          created_by?: string | null
          detachment_date?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          attachment_date?: string | null
          component_asset_id?: string
          composite_asset_id?: string
          created_at?: string | null
          created_by?: string | null
          detachment_date?: string | null
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_composite_relationships_component_asset_id_fkey"
            columns: ["component_asset_id"]
            isOneToOne: true
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_composite_relationships_component_asset_id_fkey"
            columns: ["component_asset_id"]
            isOneToOne: true
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "asset_composite_relationships_component_asset_id_fkey"
            columns: ["component_asset_id"]
            isOneToOne: true
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_composite_relationships_composite_asset_id_fkey"
            columns: ["composite_asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_composite_relationships_composite_asset_id_fkey"
            columns: ["composite_asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "asset_composite_relationships_composite_asset_id_fkey"
            columns: ["composite_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_field_verifications: {
        Row: {
          asset_id: string
          field: string
          id: string
          value_hash: string | null
          verified_at: string
          verified_by: string
        }
        Insert: {
          asset_id: string
          field: string
          id?: string
          value_hash?: string | null
          verified_at?: string
          verified_by: string
        }
        Update: {
          asset_id?: string
          field?: string
          id?: string
          value_hash?: string | null
          verified_at?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_field_verifications_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_field_verifications_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "asset_field_verifications_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_field_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "asset_field_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_field_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_field_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_field_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_field_verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_name_mappings: {
        Row: {
          asset_id: string | null
          confidence_level: number | null
          created_at: string | null
          created_by: string | null
          exception_asset_id: string | null
          external_unit: string | null
          id: string
          mapping_source: string
          mapping_type: string
          notes: string | null
          original_name: string
          source_system: string | null
          updated_at: string | null
        }
        Insert: {
          asset_id?: string | null
          confidence_level?: number | null
          created_at?: string | null
          created_by?: string | null
          exception_asset_id?: string | null
          external_unit?: string | null
          id?: string
          mapping_source: string
          mapping_type: string
          notes?: string | null
          original_name: string
          source_system?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_id?: string | null
          confidence_level?: number | null
          created_at?: string | null
          created_by?: string | null
          exception_asset_id?: string | null
          external_unit?: string | null
          id?: string
          mapping_source?: string
          mapping_type?: string
          notes?: string | null
          original_name?: string
          source_system?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_name_mappings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_name_mappings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "asset_name_mappings_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_name_mappings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "asset_name_mappings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_name_mappings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_name_mappings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_name_mappings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_name_mappings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_name_mappings_exception_asset_id_fkey"
            columns: ["exception_asset_id"]
            isOneToOne: false
            referencedRelation: "exception_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_name_mappings_exception_asset_id_fkey"
            columns: ["exception_asset_id"]
            isOneToOne: false
            referencedRelation: "exception_assets_review"
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
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
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_operators_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
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
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_operators_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
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
          component_assets: string[] | null
          composite_sync_hours: boolean
          composite_sync_kilometers: boolean
          composite_type: string | null
          created_at: string | null
          created_by: string | null
          current_hours: number | null
          current_kilometers: number | null
          department: string | null
          department_id: string | null
          fabrication_year: number | null
          id: string
          initial_hours: number | null
          initial_kilometers: number | null
          installation_date: string | null
          insurance_documents: string[] | null
          insurance_end_date: string | null
          insurance_policy: string | null
          insurance_start_date: string | null
          is_composite: boolean | null
          is_new: boolean | null
          last_inspection_date: string | null
          last_maintenance_date: string | null
          location: string | null
          model_id: string | null
          name: string
          notes: string | null
          photos: string[] | null
          plant_id: string | null
          primary_component_id: string | null
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
          component_assets?: string[] | null
          composite_sync_hours?: boolean
          composite_sync_kilometers?: boolean
          composite_type?: string | null
          created_at?: string | null
          created_by?: string | null
          current_hours?: number | null
          current_kilometers?: number | null
          department?: string | null
          department_id?: string | null
          fabrication_year?: number | null
          id?: string
          initial_hours?: number | null
          initial_kilometers?: number | null
          installation_date?: string | null
          insurance_documents?: string[] | null
          insurance_end_date?: string | null
          insurance_policy?: string | null
          insurance_start_date?: string | null
          is_composite?: boolean | null
          is_new?: boolean | null
          last_inspection_date?: string | null
          last_maintenance_date?: string | null
          location?: string | null
          model_id?: string | null
          name: string
          notes?: string | null
          photos?: string[] | null
          plant_id?: string | null
          primary_component_id?: string | null
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
          component_assets?: string[] | null
          composite_sync_hours?: boolean
          composite_sync_kilometers?: boolean
          composite_type?: string | null
          created_at?: string | null
          created_by?: string | null
          current_hours?: number | null
          current_kilometers?: number | null
          department?: string | null
          department_id?: string | null
          fabrication_year?: number | null
          id?: string
          initial_hours?: number | null
          initial_kilometers?: number | null
          installation_date?: string | null
          insurance_documents?: string[] | null
          insurance_end_date?: string | null
          insurance_policy?: string | null
          insurance_start_date?: string | null
          is_composite?: boolean | null
          is_new?: boolean | null
          last_inspection_date?: string | null
          last_maintenance_date?: string | null
          location?: string | null
          model_id?: string | null
          name?: string
          notes?: string | null
          photos?: string[] | null
          plant_id?: string | null
          primary_component_id?: string | null
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["model_uuid"]
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "assets_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "assets_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "assets_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_primary_component_id_fkey"
            columns: ["primary_component_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_primary_component_id_fkey"
            columns: ["primary_component_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "assets_primary_component_id_fkey"
            columns: ["primary_component_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets_audit_log: {
        Row: {
          after_value: string | null
          asset_id: string
          before_value: string | null
          created_at: string
          field: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          after_value?: string | null
          asset_id: string
          before_value?: string | null
          created_at?: string
          field: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          after_value?: string | null
          asset_id?: string
          before_value?: string | null
          created_at?: string
          field?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_audit_log_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_audit_log_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "assets_audit_log_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "assets_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "assets_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "assets_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "assets_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      authorization_delegation_history: {
        Row: {
          action: string
          change_reason: string | null
          changed_by_user_id: string
          created_at: string | null
          delegation_id: string
          id: string
          new_amount: number | null
          previous_amount: number | null
        }
        Insert: {
          action: string
          change_reason?: string | null
          changed_by_user_id: string
          created_at?: string | null
          delegation_id: string
          id?: string
          new_amount?: number | null
          previous_amount?: number | null
        }
        Update: {
          action?: string
          change_reason?: string | null
          changed_by_user_id?: string
          created_at?: string | null
          delegation_id?: string
          id?: string
          new_amount?: number | null
          previous_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "authorization_delegation_history_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "authorization_delegation_history_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegation_history_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegation_history_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegation_history_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegation_history_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegation_history_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "authorization_delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegation_history_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "delegation_details"
            referencedColumns: ["id"]
          },
        ]
      }
      authorization_delegations: {
        Row: {
          business_unit_id: string | null
          created_at: string | null
          delegated_amount: number
          grantee_user_id: string
          grantor_user_id: string
          id: string
          is_active: boolean
          notes: string | null
          plant_id: string | null
          scope_type: string
          updated_at: string | null
        }
        Insert: {
          business_unit_id?: string | null
          created_at?: string | null
          delegated_amount: number
          grantee_user_id: string
          grantor_user_id: string
          id?: string
          is_active?: boolean
          notes?: string | null
          plant_id?: string | null
          scope_type: string
          updated_at?: string | null
        }
        Update: {
          business_unit_id?: string | null
          created_at?: string | null
          delegated_amount?: number
          grantee_user_id?: string
          grantor_user_id?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          plant_id?: string | null
          scope_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authorization_delegations_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantee_user_id_fkey"
            columns: ["grantee_user_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "authorization_delegations_grantee_user_id_fkey"
            columns: ["grantee_user_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantee_user_id_fkey"
            columns: ["grantee_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantee_user_id_fkey"
            columns: ["grantee_user_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantee_user_id_fkey"
            columns: ["grantee_user_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantee_user_id_fkey"
            columns: ["grantee_user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantor_user_id_fkey"
            columns: ["grantor_user_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "authorization_delegations_grantor_user_id_fkey"
            columns: ["grantor_user_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantor_user_id_fkey"
            columns: ["grantor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantor_user_id_fkey"
            columns: ["grantor_user_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantor_user_id_fkey"
            columns: ["grantor_user_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantor_user_id_fkey"
            columns: ["grantor_user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegations_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "authorization_delegations_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "authorization_delegations_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "authorization_delegations_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      authorization_matrix: {
        Row: {
          approver_role: Database["public"]["Enums"]["user_role"] | null
          created_at: string | null
          description: string | null
          id: string
          max_amount: number
          requires_approval: boolean | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          approver_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string | null
          description?: string | null
          id?: string
          max_amount: number
          requires_approval?: boolean | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          approver_role?: Database["public"]["Enums"]["user_role"] | null
          created_at?: string | null
          description?: string | null
          id?: string
          max_amount?: number
          requires_approval?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      auto_create_logs: {
        Row: {
          error: string | null
          id: string
          result: Json | null
          run_at: string | null
          success: boolean | null
        }
        Insert: {
          error?: string | null
          id?: string
          result?: Json | null
          run_at?: string | null
          success?: boolean | null
        }
        Update: {
          error?: string | null
          id?: string
          result?: Json | null
          run_at?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      business_unit_limits: {
        Row: {
          business_unit_id: string
          created_at: string | null
          created_by: string | null
          id: string
          max_authorization_limit: number
          notes: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          business_unit_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_authorization_limit?: number
          notes?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          business_unit_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_authorization_limit?: number
          notes?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_unit_limits_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: true
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_unit_limits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "business_unit_limits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "business_unit_limits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_unit_limits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "business_unit_limits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "business_unit_limits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_unit_limits_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "business_unit_limits_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "business_unit_limits_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_unit_limits_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "business_unit_limits_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "business_unit_limits_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
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
      checklist_evidence: {
        Row: {
          category: string
          completed_checklist_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          metadata: Json | null
          photo_url: string
          section_id: string | null
          sequence_order: number | null
        }
        Insert: {
          category: string
          completed_checklist_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          photo_url: string
          section_id?: string | null
          sequence_order?: number | null
        }
        Update: {
          category?: string
          completed_checklist_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json | null
          photo_url?: string
          section_id?: string | null
          sequence_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_evidence_completed_checklist_id_fkey"
            columns: ["completed_checklist_id"]
            isOneToOne: false
            referencedRelation: "completed_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_evidence_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "checklist_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_issues: {
        Row: {
          checklist_id: string | null
          consolidation_window: string | null
          created_at: string | null
          created_by: string | null
          description: string
          id: string
          incident_id: string | null
          issue_fingerprint: string | null
          item_id: string
          notes: string | null
          parent_issue_id: string | null
          photo_url: string | null
          recurrence_count: number | null
          resolution_date: string | null
          resolved: boolean | null
          similar_issue_ids: Json | null
          status: string
          updated_at: string | null
          updated_by: string | null
          work_order_id: string | null
        }
        Insert: {
          checklist_id?: string | null
          consolidation_window?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          id?: string
          incident_id?: string | null
          issue_fingerprint?: string | null
          item_id: string
          notes?: string | null
          parent_issue_id?: string | null
          photo_url?: string | null
          recurrence_count?: number | null
          resolution_date?: string | null
          resolved?: boolean | null
          similar_issue_ids?: Json | null
          status: string
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          checklist_id?: string | null
          consolidation_window?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          id?: string
          incident_id?: string | null
          issue_fingerprint?: string | null
          item_id?: string
          notes?: string | null
          parent_issue_id?: string | null
          photo_url?: string | null
          recurrence_count?: number | null
          resolution_date?: string | null
          resolved?: boolean | null
          similar_issue_ids?: Json | null
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
            foreignKeyName: "checklist_issues_parent_issue_id_fkey"
            columns: ["parent_issue_id"]
            isOneToOne: false
            referencedRelation: "checklist_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_issues_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
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
          scheduled_day: string
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
          scheduled_day: string
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
          scheduled_day?: string
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
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
          cleanliness_config: Json | null
          created_at: string | null
          created_by: string | null
          evidence_config: Json | null
          id: string
          order_index: number
          section_type: string | null
          security_config: Json | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          checklist_id?: string | null
          cleanliness_config?: Json | null
          created_at?: string | null
          created_by?: string | null
          evidence_config?: Json | null
          id?: string
          order_index: number
          section_type?: string | null
          security_config?: Json | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          checklist_id?: string | null
          cleanliness_config?: Json | null
          created_at?: string | null
          created_by?: string | null
          evidence_config?: Json | null
          id?: string
          order_index?: number
          section_type?: string | null
          security_config?: Json | null
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["model_uuid"]
          },
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["model_uuid"]
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
          equipment_hours_reading: number | null
          equipment_kilometers_reading: number | null
          id: string
          notes: string | null
          previous_hours: number | null
          previous_kilometers: number | null
          reading_timestamp: string | null
          security_data: Json | null
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
          equipment_hours_reading?: number | null
          equipment_kilometers_reading?: number | null
          id?: string
          notes?: string | null
          previous_hours?: number | null
          previous_kilometers?: number | null
          reading_timestamp?: string | null
          security_data?: Json | null
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
          equipment_hours_reading?: number | null
          equipment_kilometers_reading?: number | null
          id?: string
          notes?: string | null
          previous_hours?: number | null
          previous_kilometers?: number | null
          reading_timestamp?: string | null
          security_data?: Json | null
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
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
          {
            foreignKeyName: "fk_completed_checklists_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "fk_completed_checklists_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_completed_checklists_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_completed_checklists_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_completed_checklists_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_completed_checklists_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_completed_checklists_updated_by"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "fk_completed_checklists_updated_by"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_completed_checklists_updated_by"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_completed_checklists_updated_by"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_completed_checklists_updated_by"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fk_completed_checklists_updated_by"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_dispute_history: {
        Row: {
          action: string
          created_at: string
          id: string
          incident_id: string
          notes: string | null
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          incident_id: string
          notes?: string | null
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          incident_id?: string
          notes?: string | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_dispute_history_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "compliance_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_dispute_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "compliance_dispute_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_dispute_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_dispute_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_dispute_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_dispute_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_incidents: {
        Row: {
          asset_id: string | null
          checklist_schedule_id: string | null
          created_at: string
          dispute_reason: string | null
          dispute_review_notes: string | null
          dispute_reviewed_at: string | null
          dispute_reviewed_by: string | null
          dispute_status: string | null
          dispute_submitted_at: string | null
          evidence_description: string | null
          id: string
          incident_date: string
          incident_type: string
          policy_id: string | null
          policy_rule_id: string | null
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          checklist_schedule_id?: string | null
          created_at?: string
          dispute_reason?: string | null
          dispute_review_notes?: string | null
          dispute_reviewed_at?: string | null
          dispute_reviewed_by?: string | null
          dispute_status?: string | null
          dispute_submitted_at?: string | null
          evidence_description?: string | null
          id?: string
          incident_date?: string
          incident_type: string
          policy_id?: string | null
          policy_rule_id?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          source?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          checklist_schedule_id?: string | null
          created_at?: string
          dispute_reason?: string | null
          dispute_review_notes?: string | null
          dispute_reviewed_at?: string | null
          dispute_reviewed_by?: string | null
          dispute_status?: string | null
          dispute_submitted_at?: string | null
          evidence_description?: string | null
          id?: string
          incident_date?: string
          incident_type?: string
          policy_id?: string | null
          policy_rule_id?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_incidents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "compliance_incidents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_checklist_schedule_id_fkey"
            columns: ["checklist_schedule_id"]
            isOneToOne: false
            referencedRelation: "checklist_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_checklist_schedule_id_fkey"
            columns: ["checklist_schedule_id"]
            isOneToOne: false
            referencedRelation: "checklist_schedules_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_dispute_reviewed_by_fkey"
            columns: ["dispute_reviewed_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "compliance_incidents_dispute_reviewed_by_fkey"
            columns: ["dispute_reviewed_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_incidents_dispute_reviewed_by_fkey"
            columns: ["dispute_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_dispute_reviewed_by_fkey"
            columns: ["dispute_reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_incidents_dispute_reviewed_by_fkey"
            columns: ["dispute_reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_incidents_dispute_reviewed_by_fkey"
            columns: ["dispute_reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_policy_rule_id_fkey"
            columns: ["policy_rule_id"]
            isOneToOne: false
            referencedRelation: "policy_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "compliance_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "compliance_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_incidents_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "compliance_incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          created_at: string
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          expires_at: string | null
          id: string
          is_dismissed: boolean | null
          is_read: boolean | null
          message: string
          priority: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message: string
          priority?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message?: string
          priority?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "compliance_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "compliance_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "departments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "departments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "departments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "departments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "departments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "departments_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_balance_audit_log: {
        Row: {
          action: string
          corrections_made: number | null
          created_at: string | null
          id: string
          new_balance: number | null
          notes: string | null
          old_balance: number | null
          triggered_by: string | null
          warehouse_id: string
        }
        Insert: {
          action: string
          corrections_made?: number | null
          created_at?: string | null
          id?: string
          new_balance?: number | null
          notes?: string | null
          old_balance?: number | null
          triggered_by?: string | null
          warehouse_id: string
        }
        Update: {
          action?: string
          corrections_made?: number | null
          created_at?: string | null
          id?: string
          new_balance?: number | null
          notes?: string | null
          old_balance?: number | null
          triggered_by?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diesel_balance_audit_log_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "diesel_current_inventory"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "diesel_balance_audit_log_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "diesel_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_balance_audit_log_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "monthly_inventory_summary"
            referencedColumns: ["warehouse_id"]
          },
        ]
      }
      diesel_evidence: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          evidence_type: string
          id: string
          metadata: Json | null
          photo_url: string
          transaction_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_type: string
          id?: string
          metadata?: Json | null
          photo_url: string
          transaction_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_type?: string
          id?: string
          metadata?: Json | null
          photo_url?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diesel_evidence_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "diesel_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_excel_staging: {
        Row: {
          almacen: string | null
          clave_producto: string | null
          creado: string | null
          created_at: string | null
          cuenta_litros: number | null
          fecha_: string | null
          horario: string | null
          horometro: number | null
          i: string | null
          id: number
          identificador: string | null
          inventario: number | null
          inventario_inicial: number | null
          kilometraje: number | null
          litros_cantidad: number | null
          planta: string | null
          primary_column: string | null
          processed: boolean | null
          processing_notes: string | null
          prueba_validacion: string | null
          responsable_suministro: string | null
          responsable_unidad: string | null
          tipo: string | null
          unidad: string | null
          unidad_p1: string | null
          unidad_p3: string | null
          unidad_p4: string | null
          unidad_planta_2: string | null
          unidad_planta_5: string | null
          validacion: string | null
        }
        Insert: {
          almacen?: string | null
          clave_producto?: string | null
          creado?: string | null
          created_at?: string | null
          cuenta_litros?: number | null
          fecha_?: string | null
          horario?: string | null
          horometro?: number | null
          i?: string | null
          id?: number
          identificador?: string | null
          inventario?: number | null
          inventario_inicial?: number | null
          kilometraje?: number | null
          litros_cantidad?: number | null
          planta?: string | null
          primary_column?: string | null
          processed?: boolean | null
          processing_notes?: string | null
          prueba_validacion?: string | null
          responsable_suministro?: string | null
          responsable_unidad?: string | null
          tipo?: string | null
          unidad?: string | null
          unidad_p1?: string | null
          unidad_p3?: string | null
          unidad_p4?: string | null
          unidad_planta_2?: string | null
          unidad_planta_5?: string | null
          validacion?: string | null
        }
        Update: {
          almacen?: string | null
          clave_producto?: string | null
          creado?: string | null
          created_at?: string | null
          cuenta_litros?: number | null
          fecha_?: string | null
          horario?: string | null
          horometro?: number | null
          i?: string | null
          id?: number
          identificador?: string | null
          inventario?: number | null
          inventario_inicial?: number | null
          kilometraje?: number | null
          litros_cantidad?: number | null
          planta?: string | null
          primary_column?: string | null
          processed?: boolean | null
          processing_notes?: string | null
          prueba_validacion?: string | null
          responsable_suministro?: string | null
          responsable_unidad?: string | null
          tipo?: string | null
          unidad?: string | null
          unidad_p1?: string | null
          unidad_p3?: string | null
          unidad_p4?: string | null
          unidad_planta_2?: string | null
          unidad_planta_5?: string | null
          validacion?: string | null
        }
        Relationships: []
      }
      diesel_inventory_snapshots: {
        Row: {
          closing_balance: number
          created_at: string
          id: string
          notes: string | null
          opening_balance: number
          physical_count: number | null
          snapshot_date: string
          total_adjustments: number
          total_consumptions: number
          total_entries: number
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          variance: number | null
          warehouse_id: string
        }
        Insert: {
          closing_balance: number
          created_at?: string
          id?: string
          notes?: string | null
          opening_balance?: number
          physical_count?: number | null
          snapshot_date: string
          total_adjustments?: number
          total_consumptions?: number
          total_entries?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          variance?: number | null
          warehouse_id: string
        }
        Update: {
          closing_balance?: number
          created_at?: string
          id?: string
          notes?: string | null
          opening_balance?: number
          physical_count?: number | null
          snapshot_date?: string
          total_adjustments?: number
          total_consumptions?: number
          total_entries?: number
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          variance?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diesel_inventory_snapshots_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "diesel_inventory_snapshots_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "diesel_inventory_snapshots_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_inventory_snapshots_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "diesel_inventory_snapshots_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "diesel_inventory_snapshots_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_inventory_snapshots_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "diesel_current_inventory"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "diesel_inventory_snapshots_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "diesel_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_inventory_snapshots_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "monthly_inventory_summary"
            referencedColumns: ["warehouse_id"]
          },
        ]
      }
      diesel_products: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          price_per_liter: number | null
          product_code: string
          product_type: string
          unit_of_measure: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          price_per_liter?: number | null
          product_code: string
          product_type?: string
          unit_of_measure?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          price_per_liter?: number | null
          product_code?: string
          product_type?: string
          unit_of_measure?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      diesel_transactions: {
        Row: {
          adjustment_category: string | null
          adjustment_reason: string | null
          asset_category: string
          asset_id: string | null
          checklist_completion_id: string | null
          created_at: string | null
          created_by: string
          cuenta_litros: number | null
          current_balance: number | null
          exception_asset_name: string | null
          horometer_reading: number | null
          hours_consumed: number | null
          id: string
          import_batch_id: string | null
          is_transfer: boolean
          kilometer_reading: number | null
          kilometers_consumed: number | null
          notes: string | null
          operator_id: string | null
          plant_id: string
          previous_balance: number | null
          previous_horometer: number | null
          previous_kilometer: number | null
          product_id: string
          quantity_liters: number
          reference_transaction_id: string | null
          requires_validation: boolean | null
          scheduled_time: string | null
          service_order_id: string | null
          source_system: string | null
          supplier_responsible: string | null
          total_cost: number | null
          transaction_date: string
          transaction_id: string
          transaction_type: string
          unit_cost: number | null
          updated_at: string | null
          updated_by: string | null
          validated_at: string | null
          validated_by: string | null
          validation_difference: number | null
          validation_notes: string | null
          warehouse_id: string
          work_order_id: string | null
        }
        Insert: {
          adjustment_category?: string | null
          adjustment_reason?: string | null
          asset_category: string
          asset_id?: string | null
          checklist_completion_id?: string | null
          created_at?: string | null
          created_by: string
          cuenta_litros?: number | null
          current_balance?: number | null
          exception_asset_name?: string | null
          horometer_reading?: number | null
          hours_consumed?: number | null
          id?: string
          import_batch_id?: string | null
          is_transfer?: boolean
          kilometer_reading?: number | null
          kilometers_consumed?: number | null
          notes?: string | null
          operator_id?: string | null
          plant_id: string
          previous_balance?: number | null
          previous_horometer?: number | null
          previous_kilometer?: number | null
          product_id: string
          quantity_liters: number
          reference_transaction_id?: string | null
          requires_validation?: boolean | null
          scheduled_time?: string | null
          service_order_id?: string | null
          source_system?: string | null
          supplier_responsible?: string | null
          total_cost?: number | null
          transaction_date?: string
          transaction_id: string
          transaction_type: string
          unit_cost?: number | null
          updated_at?: string | null
          updated_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_difference?: number | null
          validation_notes?: string | null
          warehouse_id: string
          work_order_id?: string | null
        }
        Update: {
          adjustment_category?: string | null
          adjustment_reason?: string | null
          asset_category?: string
          asset_id?: string | null
          checklist_completion_id?: string | null
          created_at?: string | null
          created_by?: string
          cuenta_litros?: number | null
          current_balance?: number | null
          exception_asset_name?: string | null
          horometer_reading?: number | null
          hours_consumed?: number | null
          id?: string
          import_batch_id?: string | null
          is_transfer?: boolean
          kilometer_reading?: number | null
          kilometers_consumed?: number | null
          notes?: string | null
          operator_id?: string | null
          plant_id?: string
          previous_balance?: number | null
          previous_horometer?: number | null
          previous_kilometer?: number | null
          product_id?: string
          quantity_liters?: number
          reference_transaction_id?: string | null
          requires_validation?: boolean | null
          scheduled_time?: string | null
          service_order_id?: string | null
          source_system?: string | null
          supplier_responsible?: string | null
          total_cost?: number | null
          transaction_date?: string
          transaction_id?: string
          transaction_type?: string
          unit_cost?: number | null
          updated_at?: string | null
          updated_by?: string | null
          validated_at?: string | null
          validated_by?: string | null
          validation_difference?: number | null
          validation_notes?: string | null
          warehouse_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diesel_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "diesel_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_checklist_completion_id_fkey"
            columns: ["checklist_completion_id"]
            isOneToOne: false
            referencedRelation: "completed_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "diesel_transactions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "diesel_transactions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "diesel_transactions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "diesel_transactions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "diesel_transactions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "diesel_transactions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "diesel_transactions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "diesel_current_inventory"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "diesel_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "diesel_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_reference_transaction_id_fkey"
            columns: ["reference_transaction_id"]
            isOneToOne: false
            referencedRelation: "diesel_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "diesel_transactions_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "diesel_transactions_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "diesel_transactions_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "diesel_transactions_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "diesel_current_inventory"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "diesel_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "diesel_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "monthly_inventory_summary"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "diesel_transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "diesel_transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_with_checklist_status"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_warehouses: {
        Row: {
          capacity_liters: number | null
          created_at: string | null
          created_by: string | null
          current_cuenta_litros: number | null
          current_inventory: number | null
          has_cuenta_litros: boolean | null
          id: string
          last_updated: string | null
          location_notes: string | null
          minimum_stock_level: number | null
          name: string
          needs_recalculation: boolean | null
          plant_id: string
          product_type: string
          updated_at: string | null
          updated_by: string | null
          warehouse_code: string
        }
        Insert: {
          capacity_liters?: number | null
          created_at?: string | null
          created_by?: string | null
          current_cuenta_litros?: number | null
          current_inventory?: number | null
          has_cuenta_litros?: boolean | null
          id?: string
          last_updated?: string | null
          location_notes?: string | null
          minimum_stock_level?: number | null
          name: string
          needs_recalculation?: boolean | null
          plant_id: string
          product_type?: string
          updated_at?: string | null
          updated_by?: string | null
          warehouse_code: string
        }
        Update: {
          capacity_liters?: number | null
          created_at?: string | null
          created_by?: string | null
          current_cuenta_litros?: number | null
          current_inventory?: number | null
          has_cuenta_litros?: boolean | null
          id?: string
          last_updated?: string | null
          location_notes?: string | null
          minimum_stock_level?: number | null
          name?: string
          needs_recalculation?: boolean | null
          plant_id?: string
          product_type?: string
          updated_at?: string | null
          updated_by?: string | null
          warehouse_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
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
      exception_assets: {
        Row: {
          asset_type: string | null
          created_at: string | null
          description: string | null
          exception_name: string
          first_seen: string | null
          id: string
          last_seen: string | null
          normalized_name: string | null
          owner_info: string | null
          promoted_at: string | null
          promoted_by: string | null
          promoted_to_asset_id: string | null
          total_consumption_liters: number | null
          total_transactions: number | null
          updated_at: string | null
        }
        Insert: {
          asset_type?: string | null
          created_at?: string | null
          description?: string | null
          exception_name: string
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          normalized_name?: string | null
          owner_info?: string | null
          promoted_at?: string | null
          promoted_by?: string | null
          promoted_to_asset_id?: string | null
          total_consumption_liters?: number | null
          total_transactions?: number | null
          updated_at?: string | null
        }
        Update: {
          asset_type?: string | null
          created_at?: string | null
          description?: string | null
          exception_name?: string
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          normalized_name?: string | null
          owner_info?: string | null
          promoted_at?: string | null
          promoted_by?: string | null
          promoted_to_asset_id?: string | null
          total_consumption_liters?: number | null
          total_transactions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exception_assets_promoted_by_fkey"
            columns: ["promoted_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "exception_assets_promoted_by_fkey"
            columns: ["promoted_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "exception_assets_promoted_by_fkey"
            columns: ["promoted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exception_assets_promoted_by_fkey"
            columns: ["promoted_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "exception_assets_promoted_by_fkey"
            columns: ["promoted_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "exception_assets_promoted_by_fkey"
            columns: ["promoted_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exception_assets_promoted_to_asset_id_fkey"
            columns: ["promoted_to_asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exception_assets_promoted_to_asset_id_fkey"
            columns: ["promoted_to_asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "exception_assets_promoted_to_asset_id_fkey"
            columns: ["promoted_to_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_classifications: {
        Row: {
          categoria_ingresos: string | null
          clasificacion_gerencia: string | null
          codigo_ingresos: string
          concepto_gerencia: string | null
          concepto_ingresos: string | null
          created_at: string | null
          id: string
          sub_clasificacion_gerencia: string | null
          sub_sub_clasificacion_gerencia: string | null
          updated_at: string | null
        }
        Insert: {
          categoria_ingresos?: string | null
          clasificacion_gerencia?: string | null
          codigo_ingresos: string
          concepto_gerencia?: string | null
          concepto_ingresos?: string | null
          created_at?: string | null
          id?: string
          sub_clasificacion_gerencia?: string | null
          sub_sub_clasificacion_gerencia?: string | null
          updated_at?: string | null
        }
        Update: {
          categoria_ingresos?: string | null
          clasificacion_gerencia?: string | null
          codigo_ingresos?: string
          concepto_gerencia?: string | null
          concepto_ingresos?: string | null
          created_at?: string | null
          id?: string
          sub_clasificacion_gerencia?: string | null
          sub_sub_clasificacion_gerencia?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      incident_history: {
        Row: {
          asset_id: string | null
          checklist_id: string | null
          created_at: string | null
          created_by: string | null
          date: string
          description: string
          documents: Json | null
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
          documents?: Json | null
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
          documents?: Json | null
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
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
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "incident_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_with_checklist_status"
            referencedColumns: ["id"]
          },
        ]
      }
      ingresos_gastos_kpi_plant_month: {
        Row: {
          compute_version: number
          computed_at: string
          id: string
          payload: Json
          period_month: string
          plant_id: string
        }
        Insert: {
          compute_version?: number
          computed_at?: string
          id?: string
          payload: Json
          period_month: string
          plant_id: string
        }
        Update: {
          compute_version?: number
          computed_at?: string
          id?: string
          payload?: Json
          period_month?: string
          plant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingresos_gastos_kpi_plant_month_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "ingresos_gastos_kpi_plant_month_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "ingresos_gastos_kpi_plant_month_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "ingresos_gastos_kpi_plant_month_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          id: string
          ip_address: unknown
          movement_date: string
          movement_type: string
          notes: string | null
          part_id: string
          performed_by: string
          purchase_order_id: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          stock_id: string
          supplier_return_reason: string | null
          supplier_return_status: string | null
          total_cost: number | null
          transfer_to_warehouse_id: string | null
          unit_cost: number | null
          user_agent: string | null
          warehouse_id: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: unknown
          movement_date?: string
          movement_type: string
          notes?: string | null
          part_id: string
          performed_by: string
          purchase_order_id?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          stock_id: string
          supplier_return_reason?: string | null
          supplier_return_status?: string | null
          total_cost?: number | null
          transfer_to_warehouse_id?: string | null
          unit_cost?: number | null
          user_agent?: string | null
          warehouse_id: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: unknown
          movement_date?: string
          movement_type?: string
          notes?: string | null
          part_id?: string
          performed_by?: string
          purchase_order_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          stock_id?: string
          supplier_return_reason?: string | null
          supplier_return_status?: string | null
          total_cost?: number | null
          transfer_to_warehouse_id?: string | null
          unit_cost?: number | null
          user_agent?: string | null
          warehouse_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "inventory_movements_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_expense_classification"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["stock_id"]
          },
          {
            foreignKeyName: "inventory_movements_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_transfer_to_warehouse_id_fkey"
            columns: ["transfer_to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "inventory_movements_transfer_to_warehouse_id_fkey"
            columns: ["transfer_to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_valuation"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "inventory_movements_transfer_to_warehouse_id_fkey"
            columns: ["transfer_to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_valuation"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "inventory_movements_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_with_checklist_status"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_parts: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          default_unit_cost: number | null
          description: string | null
          id: string
          is_active: boolean | null
          manufacturer: string | null
          name: string
          part_number: string
          part_number_normalized: string | null
          specifications: Json | null
          supplier_id: string | null
          unit_of_measure: string | null
          updated_at: string | null
          updated_by: string | null
          warranty_period_months: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          default_unit_cost?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          manufacturer?: string | null
          name: string
          part_number: string
          part_number_normalized?: string | null
          specifications?: Json | null
          supplier_id?: string | null
          unit_of_measure?: string | null
          updated_at?: string | null
          updated_by?: string | null
          warranty_period_months?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          default_unit_cost?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          manufacturer?: string | null
          name?: string
          part_number?: string
          part_number_normalized?: string | null
          specifications?: Json | null
          supplier_id?: string | null
          unit_of_measure?: string | null
          updated_at?: string | null
          updated_by?: string | null
          warranty_period_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_parts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          average_unit_cost: number | null
          created_at: string | null
          current_quantity: number
          id: string
          last_counted_date: string | null
          last_movement_date: string | null
          max_stock_level: number | null
          min_stock_level: number | null
          notes: string | null
          oldest_reservation_date: string | null
          part_id: string
          reorder_point: number | null
          reserved_quantity: number
          total_value: number | null
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          average_unit_cost?: number | null
          created_at?: string | null
          current_quantity?: number
          id?: string
          last_counted_date?: string | null
          last_movement_date?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          notes?: string | null
          oldest_reservation_date?: string | null
          part_id: string
          reorder_point?: number | null
          reserved_quantity?: number
          total_value?: number | null
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          average_unit_cost?: number | null
          created_at?: string | null
          current_quantity?: number
          id?: string
          last_counted_date?: string | null
          last_movement_date?: string | null
          max_stock_level?: number | null
          min_stock_level?: number | null
          notes?: string | null
          oldest_reservation_date?: string | null
          part_id?: string
          reorder_point?: number | null
          reserved_quantity?: number
          total_value?: number | null
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "inventory_stock_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "inventory_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_valuation"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "inventory_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_warehouses: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          location_notes: string | null
          name: string
          plant_id: string
          updated_at: string | null
          updated_by: string | null
          warehouse_code: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          location_notes?: string | null
          name: string
          plant_id: string
          updated_at?: string | null
          updated_by?: string | null
          warehouse_code: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          location_notes?: string | null
          name?: string
          plant_id?: string
          updated_at?: string | null
          updated_by?: string | null
          warehouse_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "inventory_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "inventory_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "inventory_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_checklists: {
        Row: {
          checklist_template_id: string | null
          completed_at: string | null
          completed_by: string | null
          completion_data: Json | null
          created_at: string | null
          id: string
          notes: string | null
          signature: string | null
          status: string | null
          updated_at: string | null
          work_order_id: string | null
        }
        Insert: {
          checklist_template_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_data?: Json | null
          created_at?: string | null
          id?: string
          notes?: string | null
          signature?: string | null
          status?: string | null
          updated_at?: string | null
          work_order_id?: string | null
        }
        Update: {
          checklist_template_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_data?: Json | null
          created_at?: string | null
          id?: string
          notes?: string | null
          signature?: string | null
          status?: string | null
          updated_at?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_checklists_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_checklists_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "maintenance_checklists_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_checklists_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_with_checklist_status"
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
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
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "maintenance_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_with_checklist_status"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_intervals: {
        Row: {
          created_at: string | null
          created_by: string | null
          cycle_defining_interval: number | null
          description: string | null
          estimated_duration: number | null
          id: string
          interval_value: number
          is_first_cycle_only: boolean | null
          is_recurring: boolean | null
          maintenance_category: string | null
          model_id: string | null
          name: string
          type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          cycle_defining_interval?: number | null
          description?: string | null
          estimated_duration?: number | null
          id?: string
          interval_value: number
          is_first_cycle_only?: boolean | null
          is_recurring?: boolean | null
          maintenance_category?: string | null
          model_id?: string | null
          name: string
          type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          cycle_defining_interval?: number | null
          description?: string | null
          estimated_duration?: number | null
          id?: string
          interval_value?: number
          is_first_cycle_only?: boolean | null
          is_recurring?: boolean | null
          maintenance_category?: string | null
          model_id?: string | null
          name?: string
          type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_intervals_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["model_uuid"]
          },
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
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
      manual_financial_adjustment_distributions: {
        Row: {
          adjustment_id: string
          amount: number
          business_unit_id: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          id: string
          percentage: number
          plant_id: string | null
          volume_m3: number | null
        }
        Insert: {
          adjustment_id: string
          amount: number
          business_unit_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          id?: string
          percentage: number
          plant_id?: string | null
          volume_m3?: number | null
        }
        Update: {
          adjustment_id?: string
          amount?: number
          business_unit_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          id?: string
          percentage?: number
          plant_id?: string | null
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_financial_adjustment_distributions_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "manual_financial_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_financial_adjustment_distributions_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_financial_adjustment_distributions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "manual_financial_adjustment_distributions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_financial_adjustment_distributions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_financial_adjustment_distributions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_financial_adjustment_distributions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_financial_adjustment_distributions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_financial_adjustment_distributions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "manual_financial_adjustment_distributions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "manual_financial_adjustment_distributions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "manual_financial_adjustment_distributions_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_financial_adjustments: {
        Row: {
          amount: number
          business_unit_id: string | null
          category: string
          created_at: string | null
          created_by: string | null
          department: string | null
          description: string | null
          distribution_method: string | null
          expense_category: string | null
          expense_subcategory: string | null
          id: string
          is_bonus: boolean | null
          is_cash_payment: boolean | null
          is_distributed: boolean | null
          notes: string | null
          period_month: string
          plant_id: string | null
          subcategory: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          amount: number
          business_unit_id?: string | null
          category: string
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          distribution_method?: string | null
          expense_category?: string | null
          expense_subcategory?: string | null
          id?: string
          is_bonus?: boolean | null
          is_cash_payment?: boolean | null
          is_distributed?: boolean | null
          notes?: string | null
          period_month: string
          plant_id?: string | null
          subcategory?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          amount?: number
          business_unit_id?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          distribution_method?: string | null
          expense_category?: string | null
          expense_subcategory?: string | null
          id?: string
          is_bonus?: boolean | null
          is_cash_payment?: boolean | null
          is_distributed?: boolean | null
          notes?: string | null
          period_month?: string
          plant_id?: string | null
          subcategory?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_financial_adjustments_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "manual_financial_adjustments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["model_uuid"]
          },
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
      offices: {
        Row: {
          address: string
          created_at: string | null
          email: string
          hr_phone: string
          id: string
          name: string
          phone: string
          updated_at: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          email: string
          hr_phone: string
          id?: string
          name: string
          phone: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          email?: string
          hr_phone?: string
          id?: string
          name?: string
          phone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      operator_assignment_history: {
        Row: {
          asset_id: string | null
          assignment_type: string
          change_reason: string | null
          changed_by: string | null
          created_at: string | null
          id: string
          new_asset_id: string | null
          operation_type: string
          operator_id: string | null
          previous_asset_id: string | null
          transfer_id: string | null
        }
        Insert: {
          asset_id?: string | null
          assignment_type: string
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_asset_id?: string | null
          operation_type: string
          operator_id?: string | null
          previous_asset_id?: string | null
          transfer_id?: string | null
        }
        Update: {
          asset_id?: string | null
          assignment_type?: string
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_asset_id?: string | null
          operation_type?: string
          operator_id?: string | null
          previous_asset_id?: string | null
          transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_assignment_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignment_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "operator_assignment_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignment_history_new_asset_id_fkey"
            columns: ["new_asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignment_history_new_asset_id_fkey"
            columns: ["new_asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "operator_assignment_history_new_asset_id_fkey"
            columns: ["new_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignment_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "operator_assignment_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "operator_assignment_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignment_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "operator_assignment_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "operator_assignment_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignment_history_previous_asset_id_fkey"
            columns: ["previous_asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignment_history_previous_asset_id_fkey"
            columns: ["previous_asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "operator_assignment_history_previous_asset_id_fkey"
            columns: ["previous_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      plants: {
        Row: {
          address: string | null
          business_unit_id: string | null
          code: string
          contact_email: string | null
          contact_info: Json | null
          contact_phone: string | null
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
          contact_email?: string | null
          contact_info?: Json | null
          contact_phone?: string | null
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
          contact_email?: string | null
          contact_info?: Json | null
          contact_phone?: string | null
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
      po_action_tokens: {
        Row: {
          action: string
          created_at: string
          expires_at: string
          id: string
          jwt_token: string
          purchase_order_id: string
          quotation_id: string | null
          recipient_email: string
          recipient_user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          expires_at: string
          id?: string
          jwt_token: string
          purchase_order_id: string
          quotation_id?: string | null
          recipient_email: string
          recipient_user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          expires_at?: string
          id?: string
          jwt_token?: string
          purchase_order_id?: string
          quotation_id?: string | null
          recipient_email?: string
          recipient_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "po_action_tokens_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_action_tokens_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_action_tokens_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_expense_classification"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_action_tokens_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      po_inventory_receipts: {
        Row: {
          created_at: string | null
          id: string
          items: Json
          notes: string | null
          purchase_order_id: string
          receipt_date: string
          receipt_number: string
          received_by: string
          total_items: number
          total_value: number
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          items: Json
          notes?: string | null
          purchase_order_id: string
          receipt_date?: string
          receipt_number: string
          received_by: string
          total_items: number
          total_value: number
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          items?: Json
          notes?: string | null
          purchase_order_id?: string
          receipt_date?: string
          receipt_number?: string
          received_by?: string
          total_items?: number
          total_value?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_inventory_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_inventory_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_inventory_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_expense_classification"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_inventory_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "po_inventory_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_valuation"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "po_inventory_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          document_url: string | null
          effective_date: string | null
          id: string
          is_active: boolean | null
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_url?: string | null
          effective_date?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_url?: string | null
          effective_date?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_acknowledgments: {
        Row: {
          acknowledged_at: string
          comprehension_score: number | null
          created_at: string
          id: string
          ip_address: unknown
          policy_id: string
          signature_data: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          comprehension_score?: number | null
          created_at?: string
          id?: string
          ip_address?: unknown
          policy_id: string
          signature_data?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          comprehension_score?: number | null
          created_at?: string
          id?: string
          ip_address?: unknown
          policy_id?: string
          signature_data?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_acknowledgments_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "policy_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "policy_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "policy_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "policy_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_rules: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean | null
          policy_id: string
          rule_number: string
          rule_type: string
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          is_active?: boolean | null
          policy_id: string
          rule_number: string
          rule_type: string
          severity: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean | null
          policy_id?: string
          rule_number?: string
          rule_type?: string
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_rules_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_managed_plants: {
        Row: {
          created_at: string
          plant_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          plant_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          plant_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_managed_plants_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "profile_managed_plants_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "profile_managed_plants_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "profile_managed_plants_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_managed_plants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "profile_managed_plants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profile_managed_plants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_managed_plants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profile_managed_plants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profile_managed_plants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apellido: string | null
          avatar_url: string | null
          business_role: string | null
          business_unit_id: string | null
          can_authorize_up_to: number | null
          certificaciones: string[] | null
          created_at: string
          credential_notes: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          departamento: string | null
          direccion: string | null
          email: string | null
          emergency_contact: Json | null
          employee_code: string | null
          estado_civil: string | null
          experiencia_anos: number | null
          fecha_nacimiento: string | null
          fecha_ultima_capacitacion: string | null
          hire_date: string | null
          id: string
          imss_number: string | null
          is_active: boolean
          is_operator: boolean | null
          nivel_educacion: string | null
          nombre: string | null
          notas_rh: string | null
          office_id: string | null
          phone_secondary: string | null
          plant_id: string | null
          position: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          role_scope: string | null
          shift: string | null
          status: string | null
          system_access_password: string | null
          system_password: string | null
          system_username: string | null
          telefono: string | null
          tipo_contrato: string | null
          updated_at: string
        }
        Insert: {
          apellido?: string | null
          avatar_url?: string | null
          business_role?: string | null
          business_unit_id?: string | null
          can_authorize_up_to?: number | null
          certificaciones?: string[] | null
          created_at?: string
          credential_notes?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          departamento?: string | null
          direccion?: string | null
          email?: string | null
          emergency_contact?: Json | null
          employee_code?: string | null
          estado_civil?: string | null
          experiencia_anos?: number | null
          fecha_nacimiento?: string | null
          fecha_ultima_capacitacion?: string | null
          hire_date?: string | null
          id: string
          imss_number?: string | null
          is_active?: boolean
          is_operator?: boolean | null
          nivel_educacion?: string | null
          nombre?: string | null
          notas_rh?: string | null
          office_id?: string | null
          phone_secondary?: string | null
          plant_id?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          role_scope?: string | null
          shift?: string | null
          status?: string | null
          system_access_password?: string | null
          system_password?: string | null
          system_username?: string | null
          telefono?: string | null
          tipo_contrato?: string | null
          updated_at?: string
        }
        Update: {
          apellido?: string | null
          avatar_url?: string | null
          business_role?: string | null
          business_unit_id?: string | null
          can_authorize_up_to?: number | null
          certificaciones?: string[] | null
          created_at?: string
          credential_notes?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          departamento?: string | null
          direccion?: string | null
          email?: string | null
          emergency_contact?: Json | null
          employee_code?: string | null
          estado_civil?: string | null
          experiencia_anos?: number | null
          fecha_nacimiento?: string | null
          fecha_ultima_capacitacion?: string | null
          hire_date?: string | null
          id?: string
          imss_number?: string | null
          is_active?: boolean
          is_operator?: boolean | null
          nivel_educacion?: string | null
          nombre?: string | null
          notas_rh?: string | null
          office_id?: string | null
          phone_secondary?: string | null
          plant_id?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          role_scope?: string | null
          shift?: string | null
          status?: string | null
          system_access_password?: string | null
          system_password?: string | null
          system_username?: string | null
          telefono?: string | null
          tipo_contrato?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_quotations: {
        Row: {
          additional_files: Json
          created_at: string | null
          created_by: string | null
          delivery_days: number | null
          file_name: string | null
          file_storage_path: string | null
          file_url: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          purchase_order_id: string
          quotation_items: Json | null
          quoted_amount: number
          rejection_reason: string | null
          selected_at: string | null
          selected_by: string | null
          selection_reason: string | null
          status: string | null
          supplier_id: string | null
          supplier_name: string
          updated_at: string | null
          validity_date: string | null
        }
        Insert: {
          additional_files?: Json
          created_at?: string | null
          created_by?: string | null
          delivery_days?: number | null
          file_name?: string | null
          file_storage_path?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          purchase_order_id: string
          quotation_items?: Json | null
          quoted_amount: number
          rejection_reason?: string | null
          selected_at?: string | null
          selected_by?: string | null
          selection_reason?: string | null
          status?: string | null
          supplier_id?: string | null
          supplier_name: string
          updated_at?: string | null
          validity_date?: string | null
        }
        Update: {
          additional_files?: Json
          created_at?: string | null
          created_by?: string | null
          delivery_days?: number | null
          file_name?: string | null
          file_storage_path?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          purchase_order_id?: string
          quotation_items?: Json | null
          quoted_amount?: number
          rejection_reason?: string | null
          selected_at?: string | null
          selected_by?: string | null
          selection_reason?: string | null
          status?: string | null
          supplier_id?: string | null
          supplier_name?: string
          updated_at?: string | null
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_quotations_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_quotations_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_quotations_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_expense_classification"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_quotations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "accounts_payable_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_expense_classification"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_amount: number | null
          actual_delivery_date: string | null
          adjusted_at: string | null
          adjusted_by: string | null
          adjusted_total_amount: number | null
          adjustment_amount: number | null
          adjustment_reason: string | null
          adjustment_status: string | null
          approval_amount: number | null
          approval_amount_source: string | null
          approval_date: string | null
          approved_by: string | null
          authorization_date: string | null
          authorized_by: string | null
          created_at: string | null
          enhanced_status: string | null
          expected_delivery_date: string | null
          fulfilled_at: string | null
          fulfillment_source: string | null
          id: string
          inventory_fulfilled: boolean | null
          inventory_fulfilled_by: string | null
          inventory_fulfillment_date: string | null
          invoice_date: string | null
          invoice_number: string | null
          is_adjustment: boolean | null
          items: Json | null
          max_payment_date: string | null
          notes: string | null
          order_id: string
          original_purchase_order_id: string | null
          paid_by: string | null
          payment_condition: string | null
          payment_date: string | null
          payment_method: string | null
          payment_notes: string | null
          payment_reference: string | null
          payment_status: string | null
          plant_id: string | null
          po_purpose: string | null
          po_type: string | null
          posting_date: string | null
          purchase_date: string | null
          purchased_at: string | null
          quotation_selection_required: boolean | null
          quotation_selection_status: string | null
          quotation_url: string | null
          quotation_urls: Json | null
          quote_required_reason: string | null
          receipt_uploaded: boolean | null
          received_items_summary: Json | null
          received_to_inventory: boolean | null
          received_to_inventory_by: string | null
          received_to_inventory_date: string | null
          requested_by: string | null
          requires_adjustment: boolean | null
          requires_approval: boolean | null
          requires_quote: boolean | null
          selected_quotation_id: string | null
          service_provider: string | null
          status: string | null
          store_location: string | null
          supplier: string | null
          supplier_id: string | null
          total_amount: number | null
          updated_at: string | null
          updated_by: string | null
          viability_checked_by: string | null
          viability_state: string | null
          work_order_id: string | null
          work_order_type: string | null
        }
        Insert: {
          actual_amount?: number | null
          actual_delivery_date?: string | null
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjusted_total_amount?: number | null
          adjustment_amount?: number | null
          adjustment_reason?: string | null
          adjustment_status?: string | null
          approval_amount?: number | null
          approval_amount_source?: string | null
          approval_date?: string | null
          approved_by?: string | null
          authorization_date?: string | null
          authorized_by?: string | null
          created_at?: string | null
          enhanced_status?: string | null
          expected_delivery_date?: string | null
          fulfilled_at?: string | null
          fulfillment_source?: string | null
          id?: string
          inventory_fulfilled?: boolean | null
          inventory_fulfilled_by?: string | null
          inventory_fulfillment_date?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          is_adjustment?: boolean | null
          items?: Json | null
          max_payment_date?: string | null
          notes?: string | null
          order_id: string
          original_purchase_order_id?: string | null
          paid_by?: string | null
          payment_condition?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          plant_id?: string | null
          po_purpose?: string | null
          po_type?: string | null
          posting_date?: string | null
          purchase_date?: string | null
          purchased_at?: string | null
          quotation_selection_required?: boolean | null
          quotation_selection_status?: string | null
          quotation_url?: string | null
          quotation_urls?: Json | null
          quote_required_reason?: string | null
          receipt_uploaded?: boolean | null
          received_items_summary?: Json | null
          received_to_inventory?: boolean | null
          received_to_inventory_by?: string | null
          received_to_inventory_date?: string | null
          requested_by?: string | null
          requires_adjustment?: boolean | null
          requires_approval?: boolean | null
          requires_quote?: boolean | null
          selected_quotation_id?: string | null
          service_provider?: string | null
          status?: string | null
          store_location?: string | null
          supplier?: string | null
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          viability_checked_by?: string | null
          viability_state?: string | null
          work_order_id?: string | null
          work_order_type?: string | null
        }
        Update: {
          actual_amount?: number | null
          actual_delivery_date?: string | null
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjusted_total_amount?: number | null
          adjustment_amount?: number | null
          adjustment_reason?: string | null
          adjustment_status?: string | null
          approval_amount?: number | null
          approval_amount_source?: string | null
          approval_date?: string | null
          approved_by?: string | null
          authorization_date?: string | null
          authorized_by?: string | null
          created_at?: string | null
          enhanced_status?: string | null
          expected_delivery_date?: string | null
          fulfilled_at?: string | null
          fulfillment_source?: string | null
          id?: string
          inventory_fulfilled?: boolean | null
          inventory_fulfilled_by?: string | null
          inventory_fulfillment_date?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          is_adjustment?: boolean | null
          items?: Json | null
          max_payment_date?: string | null
          notes?: string | null
          order_id?: string
          original_purchase_order_id?: string | null
          paid_by?: string | null
          payment_condition?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          plant_id?: string | null
          po_purpose?: string | null
          po_type?: string | null
          posting_date?: string | null
          purchase_date?: string | null
          purchased_at?: string | null
          quotation_selection_required?: boolean | null
          quotation_selection_status?: string | null
          quotation_url?: string | null
          quotation_urls?: Json | null
          quote_required_reason?: string | null
          receipt_uploaded?: boolean | null
          received_items_summary?: Json | null
          received_to_inventory?: boolean | null
          received_to_inventory_by?: string | null
          received_to_inventory_date?: string | null
          requested_by?: string | null
          requires_adjustment?: boolean | null
          requires_approval?: boolean | null
          requires_quote?: boolean | null
          selected_quotation_id?: string | null
          service_provider?: string | null
          status?: string | null
          store_location?: string | null
          supplier?: string | null
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          viability_checked_by?: string | null
          viability_state?: string | null
          work_order_id?: string | null
          work_order_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_original_purchase_order_id_fkey"
            columns: ["original_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_original_purchase_order_id_fkey"
            columns: ["original_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_original_purchase_order_id_fkey"
            columns: ["original_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_expense_classification"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "purchase_orders_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_selected_quotation_id_fkey"
            columns: ["selected_quotation_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "purchase_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_with_checklist_status"
            referencedColumns: ["id"]
          },
        ]
      }
      sanctions: {
        Row: {
          applied_by: string
          applied_date: string
          created_at: string
          description: string
          id: string
          incident_id: string | null
          percentage: number | null
          policy_rule_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          sanction_amount: number | null
          sanction_type: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_by: string
          applied_date?: string
          created_at?: string
          description: string
          id?: string
          incident_id?: string | null
          percentage?: number | null
          policy_rule_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sanction_amount?: number | null
          sanction_type: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_by?: string
          applied_date?: string
          created_at?: string
          description?: string
          id?: string
          incident_id?: string | null
          percentage?: number | null
          policy_rule_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sanction_amount?: number | null
          sanction_type?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sanctions_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "sanctions_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sanctions_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sanctions_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sanctions_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "compliance_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_policy_rule_id_fkey"
            columns: ["policy_rule_id"]
            isOneToOne: false
            referencedRelation: "policy_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "sanctions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sanctions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sanctions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sanctions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "sanctions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sanctions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sanctions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sanctions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
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
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "service_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_with_checklist_status"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_business_units: {
        Row: {
          business_unit_id: string
          created_at: string | null
          supplier_id: string
        }
        Insert: {
          business_unit_id: string
          created_at?: string | null
          supplier_id: string
        }
        Update: {
          business_unit_id?: string
          created_at?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_business_units_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_business_units_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_certifications: {
        Row: {
          certificate_url: string | null
          certification_name: string
          certification_number: string | null
          created_at: string | null
          expiration_date: string | null
          id: string
          is_active: boolean | null
          issue_date: string | null
          issuing_body: string | null
          supplier_id: string
        }
        Insert: {
          certificate_url?: string | null
          certification_name: string
          certification_number?: string | null
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          issue_date?: string | null
          issuing_body?: string | null
          supplier_id: string
        }
        Update: {
          certificate_url?: string | null
          certification_name?: string
          certification_number?: string | null
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          issue_date?: string | null
          issuing_body?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_certifications_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contacts: {
        Row: {
          contact_type: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          mobile_phone: string | null
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          contact_type?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          mobile_phone?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          contact_type?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          mobile_phone?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_part_numbers: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          notes: string | null
          part_id: string
          supplier_id: string
          supplier_part_name: string | null
          supplier_part_number: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          part_id: string
          supplier_id: string
          supplier_part_name?: string | null
          supplier_part_number: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          part_id?: string
          supplier_id?: string
          supplier_part_name?: string | null
          supplier_part_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_part_numbers_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["part_id"]
          },
          {
            foreignKeyName: "supplier_part_numbers_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "inventory_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_part_numbers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_performance_history: {
        Row: {
          actual_cost: number | null
          created_at: string | null
          delivery_date: string | null
          delivery_rating: number | null
          id: string
          issues: string[] | null
          notes: string | null
          order_date: string
          promised_delivery_date: string | null
          purchase_order_id: string | null
          quality_rating: number | null
          quoted_cost: number | null
          resolution_time_hours: number | null
          service_rating: number | null
          supplier_id: string
          updated_at: string | null
          work_order_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          created_at?: string | null
          delivery_date?: string | null
          delivery_rating?: number | null
          id?: string
          issues?: string[] | null
          notes?: string | null
          order_date: string
          promised_delivery_date?: string | null
          purchase_order_id?: string | null
          quality_rating?: number | null
          quoted_cost?: number | null
          resolution_time_hours?: number | null
          service_rating?: number | null
          supplier_id: string
          updated_at?: string | null
          work_order_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          created_at?: string | null
          delivery_date?: string | null
          delivery_rating?: number | null
          id?: string
          issues?: string[] | null
          notes?: string | null
          order_date?: string
          promised_delivery_date?: string | null
          purchase_order_id?: string | null
          quality_rating?: number | null
          quoted_cost?: number | null
          resolution_time_hours?: number | null
          service_rating?: number | null
          supplier_id?: string
          updated_at?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_performance_history_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_performance_history_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_performance_history_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_expense_classification"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_performance_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_performance_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "supplier_performance_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_performance_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_with_checklist_status"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_services: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          lead_time_days: number | null
          max_order_quantity: number | null
          min_order_quantity: number | null
          service_category: string | null
          service_name: string
          stock_available: number | null
          supplier_id: string
          unit_cost: number | null
          unit_of_measure: string | null
          updated_at: string | null
          warranty_period: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lead_time_days?: number | null
          max_order_quantity?: number | null
          min_order_quantity?: number | null
          service_category?: string | null
          service_name: string
          stock_available?: number | null
          supplier_id: string
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string | null
          warranty_period?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          lead_time_days?: number | null
          max_order_quantity?: number | null
          min_order_quantity?: number | null
          service_category?: string | null
          service_name?: string
          stock_available?: number | null
          supplier_id?: string
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string | null
          warranty_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_services_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_verification_events: {
        Row: {
          action: string
          actor_id: string
          checklist_snapshot: Json | null
          created_at: string
          id: string
          notes: string | null
          supplier_id: string
        }
        Insert: {
          action: string
          actor_id: string
          checklist_snapshot?: Json | null
          created_at?: string
          id?: string
          notes?: string | null
          supplier_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          checklist_snapshot?: Json | null
          created_at?: string
          id?: string
          notes?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_verification_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "supplier_verification_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "supplier_verification_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_verification_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "supplier_verification_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "supplier_verification_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_verification_events_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_work_history: {
        Row: {
          asset_id: string | null
          completed_on_time: boolean | null
          created_at: string | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string
          labor_hours: number | null
          parts_used: Json | null
          problem_description: string | null
          quality_satisfaction: number | null
          solution_description: string | null
          supplier_id: string
          total_cost: number | null
          updated_at: string | null
          warranty_expiration: string | null
          work_order_id: string | null
          work_type: string | null
          would_recommend: boolean | null
        }
        Insert: {
          asset_id?: string | null
          completed_on_time?: boolean | null
          created_at?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          labor_hours?: number | null
          parts_used?: Json | null
          problem_description?: string | null
          quality_satisfaction?: number | null
          solution_description?: string | null
          supplier_id: string
          total_cost?: number | null
          updated_at?: string | null
          warranty_expiration?: string | null
          work_order_id?: string | null
          work_type?: string | null
          would_recommend?: boolean | null
        }
        Update: {
          asset_id?: string | null
          completed_on_time?: boolean | null
          created_at?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          labor_hours?: number | null
          parts_used?: Json | null
          problem_description?: string | null
          quality_satisfaction?: number | null
          solution_description?: string | null
          supplier_id?: string
          total_cost?: number | null
          updated_at?: string | null
          warranty_expiration?: string | null
          work_order_id?: string | null
          work_type?: string | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_work_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_work_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "supplier_work_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_work_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_work_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "supplier_work_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_work_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_with_checklist_status"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          alias_of: string | null
          avg_delivery_time: number | null
          avg_order_amount: number | null
          bank_account_info: Json | null
          business_hours: Json | null
          business_name: string | null
          business_unit_id: string | null
          certifications: string[] | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          industry: string | null
          mobile_phone: string | null
          name: string
          notes: string | null
          payment_methods: string[] | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          rating: number | null
          reliability_score: number | null
          serves_all_business_units: boolean
          specialties: string[] | null
          state: string | null
          status: string | null
          supplier_type: string | null
          tax_document_url: string | null
          tax_exempt: boolean | null
          tax_id: string | null
          total_amount: number | null
          total_orders: number | null
          updated_at: string | null
          updated_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          address?: string | null
          alias_of?: string | null
          avg_delivery_time?: number | null
          avg_order_amount?: number | null
          bank_account_info?: Json | null
          business_hours?: Json | null
          business_name?: string | null
          business_unit_id?: string | null
          certifications?: string[] | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          mobile_phone?: string | null
          name: string
          notes?: string | null
          payment_methods?: string[] | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          rating?: number | null
          reliability_score?: number | null
          serves_all_business_units?: boolean
          specialties?: string[] | null
          state?: string | null
          status?: string | null
          supplier_type?: string | null
          tax_document_url?: string | null
          tax_exempt?: boolean | null
          tax_id?: string | null
          total_amount?: number | null
          total_orders?: number | null
          updated_at?: string | null
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          address?: string | null
          alias_of?: string | null
          avg_delivery_time?: number | null
          avg_order_amount?: number | null
          bank_account_info?: Json | null
          business_hours?: Json | null
          business_name?: string | null
          business_unit_id?: string | null
          certifications?: string[] | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          mobile_phone?: string | null
          name?: string
          notes?: string | null
          payment_methods?: string[] | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          rating?: number | null
          reliability_score?: number | null
          serves_all_business_units?: boolean
          specialties?: string[] | null
          state?: string | null
          status?: string | null
          supplier_type?: string | null
          tax_document_url?: string | null
          tax_exempt?: boolean | null
          tax_id?: string | null
          total_amount?: number | null
          total_orders?: number | null
          updated_at?: string | null
          updated_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_alias_of_fkey"
            columns: ["alias_of"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "suppliers_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "suppliers_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "suppliers_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "suppliers_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings_audit_log: {
        Row: {
          change_reason: string | null
          changed_by: string
          created_at: string
          id: string
          new_value: Json
          old_value: Json | null
          setting_key: string
        }
        Insert: {
          change_reason?: string | null
          changed_by: string
          created_at?: string
          id?: string
          new_value: Json
          old_value?: Json | null
          setting_key: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          id?: string
          new_value?: Json
          old_value?: Json | null
          setting_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "system_settings_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "system_settings_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_settings_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "system_settings_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "system_settings_audit_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
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
      trust_field_policies: {
        Row: {
          field: string
          severity: string
          window_days: number | null
        }
        Insert: {
          field: string
          severity?: string
          window_days?: number | null
        }
        Update: {
          field?: string
          severity?: string
          window_days?: number | null
        }
        Relationships: []
      }
      unit_conversions: {
        Row: {
          conversion_factor: number
          created_at: string | null
          from_unit: string
          id: string
          is_bidirectional: boolean | null
          to_unit: string
        }
        Insert: {
          conversion_factor: number
          created_at?: string | null
          from_unit: string
          id?: string
          is_bidirectional?: boolean | null
          to_unit: string
        }
        Update: {
          conversion_factor?: number
          created_at?: string | null
          from_unit?: string
          id?: string
          is_bidirectional?: boolean | null
          to_unit?: string
        }
        Relationships: []
      }
      user_admin_context: {
        Row: {
          admin_level: string
          business_unit_id: string | null
          plant_id: string | null
          updated_at: string | null
          user_id: string
          user_role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          admin_level: string
          business_unit_id?: string | null
          plant_id?: string | null
          updated_at?: string | null
          user_id: string
          user_role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          admin_level?: string
          business_unit_id?: string | null
          plant_id?: string | null
          updated_at?: string | null
          user_id?: string
          user_role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "user_admin_context_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_admin_context_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "user_admin_context_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "user_admin_context_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "user_admin_context_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_admin_context_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "user_admin_context_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_admin_context_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_admin_context_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_admin_context_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_admin_context_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      user_saved_views: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_shared: boolean
          name: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_shared?: boolean
          name: string
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_shared?: boolean
          name?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "user_saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_responsibilities: {
        Row: {
          can_adjust_inventory: boolean
          can_receive_inventory: boolean
          can_release_inventory: boolean
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          id: string
          plant_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          warehouse_id: string | null
        }
        Insert: {
          can_adjust_inventory?: boolean
          can_receive_inventory?: boolean
          can_release_inventory?: boolean
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          plant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          warehouse_id?: string | null
        }
        Update: {
          can_adjust_inventory?: boolean
          can_receive_inventory?: boolean
          can_release_inventory?: boolean
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          plant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_responsibilities_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "warehouse_responsibilities_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "warehouse_responsibilities_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "warehouse_responsibilities_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_responsibilities_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "warehouse_responsibilities_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_valuation"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "warehouse_responsibilities_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "inventory_warehouses"
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
          assigned_supplier_id: string | null
          assigned_to: string | null
          checklist_id: string | null
          completed_at: string | null
          completion_photos: Json | null
          created_at: string | null
          creation_photos: Json | null
          description: string
          escalation_count: number | null
          estimated_cost: number | null
          estimated_duration: number | null
          id: string
          incident_id: string | null
          inventory_check_date: string | null
          inventory_checked: boolean | null
          inventory_reservation_date: string | null
          inventory_reserved: boolean | null
          issue_history: Json | null
          issue_items: Json | null
          last_escalation_date: string | null
          maintenance_plan_id: string | null
          order_id: string
          original_priority: string | null
          planned_date: string | null
          plant_id: string | null
          preventive_checklist_completed: boolean | null
          preventive_checklist_id: string | null
          priority: string | null
          progress_photos: Json | null
          purchase_order_id: string | null
          related_issues_count: number | null
          requested_by: string | null
          required_parts: Json | null
          required_tasks: Json | null
          reserved_parts_summary: Json | null
          scope: string | null
          service_order_id: string | null
          status: string | null
          suggested_supplier_id: string | null
          supplier_assignment_by: string | null
          supplier_assignment_date: string | null
          supplier_notes: string | null
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
          assigned_supplier_id?: string | null
          assigned_to?: string | null
          checklist_id?: string | null
          completed_at?: string | null
          completion_photos?: Json | null
          created_at?: string | null
          creation_photos?: Json | null
          description: string
          escalation_count?: number | null
          estimated_cost?: number | null
          estimated_duration?: number | null
          id?: string
          incident_id?: string | null
          inventory_check_date?: string | null
          inventory_checked?: boolean | null
          inventory_reservation_date?: string | null
          inventory_reserved?: boolean | null
          issue_history?: Json | null
          issue_items?: Json | null
          last_escalation_date?: string | null
          maintenance_plan_id?: string | null
          order_id: string
          original_priority?: string | null
          planned_date?: string | null
          plant_id?: string | null
          preventive_checklist_completed?: boolean | null
          preventive_checklist_id?: string | null
          priority?: string | null
          progress_photos?: Json | null
          purchase_order_id?: string | null
          related_issues_count?: number | null
          requested_by?: string | null
          required_parts?: Json | null
          required_tasks?: Json | null
          reserved_parts_summary?: Json | null
          scope?: string | null
          service_order_id?: string | null
          status?: string | null
          suggested_supplier_id?: string | null
          supplier_assignment_by?: string | null
          supplier_assignment_date?: string | null
          supplier_notes?: string | null
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
          assigned_supplier_id?: string | null
          assigned_to?: string | null
          checklist_id?: string | null
          completed_at?: string | null
          completion_photos?: Json | null
          created_at?: string | null
          creation_photos?: Json | null
          description?: string
          escalation_count?: number | null
          estimated_cost?: number | null
          estimated_duration?: number | null
          id?: string
          incident_id?: string | null
          inventory_check_date?: string | null
          inventory_checked?: boolean | null
          inventory_reservation_date?: string | null
          inventory_reserved?: boolean | null
          issue_history?: Json | null
          issue_items?: Json | null
          last_escalation_date?: string | null
          maintenance_plan_id?: string | null
          order_id?: string
          original_priority?: string | null
          planned_date?: string | null
          plant_id?: string | null
          preventive_checklist_completed?: boolean | null
          preventive_checklist_id?: string | null
          priority?: string | null
          progress_photos?: Json | null
          purchase_order_id?: string | null
          related_issues_count?: number | null
          requested_by?: string | null
          required_parts?: Json | null
          required_tasks?: Json | null
          reserved_parts_summary?: Json | null
          scope?: string | null
          service_order_id?: string | null
          status?: string | null
          suggested_supplier_id?: string | null
          supplier_assignment_by?: string | null
          supplier_assignment_date?: string | null
          supplier_notes?: string | null
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_assigned_supplier_id_fkey"
            columns: ["assigned_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incident_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "work_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "work_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "work_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_preventive_checklist_id_fkey"
            columns: ["preventive_checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_expense_classification"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_suggested_supplier_id_fkey"
            columns: ["suggested_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      accounts_payable_summary: {
        Row: {
          actual_amount: number | null
          created_at: string | null
          days_until_due: number | null
          id: string | null
          max_payment_date: string | null
          order_id: string | null
          paid_by_name: string | null
          payment_date: string | null
          payment_method: string | null
          payment_notes: string | null
          payment_reference: string | null
          payment_status: string | null
          payment_status_display: string | null
          po_type: string | null
          purchased_at: string | null
          requested_by_name: string | null
          service_provider: string | null
          status: string | null
          store_location: string | null
          supplier: string | null
          total_amount: number | null
        }
        Relationships: []
      }
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["model_uuid"]
          },
          {
            foreignKeyName: "assets_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "equipment_models"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_conflicts: {
        Row: {
          asset_id: string | null
          conflict_type: string | null
          detail: string | null
          equipment_model_id: string | null
          payload: Json | null
          severity: string | null
        }
        Relationships: []
      }
      asset_meter_reading_events: {
        Row: {
          actor_user_id: string | null
          asset_id: string | null
          event_at: string | null
          exception_asset_name: string | null
          hours_consumed: number | null
          hours_reading: number | null
          km_consumed: number | null
          km_reading: number | null
          plant_id: string | null
          previous_hours: number | null
          previous_km: number | null
          quantity_liters: number | null
          recorded_at: string | null
          row_source: string | null
          source_id: string | null
          source_kind: string | null
          warehouse_id: string | null
        }
        Relationships: []
      }
      asset_operator_assignments: {
        Row: {
          asset_code: string | null
          asset_id: string | null
          asset_name: string | null
          assignment_type: string | null
          business_unit_name: string | null
          employee_code: string | null
          end_date: string | null
          id: string | null
          operator_id: string | null
          operator_name: string | null
          plant_name: string | null
          start_date: string | null
          status: string | null
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "asset_operators_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_operators_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
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
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_operators_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
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
      asset_operators_full: {
        Row: {
          asset_code: string | null
          asset_id: string | null
          asset_name: string | null
          asset_plant_code: string | null
          asset_plant_id: string | null
          asset_plant_name: string | null
          asset_plant_uuid: string | null
          asset_status: string | null
          asset_uuid: string | null
          assigned_by: string | null
          assignment_type: string | null
          created_at: string | null
          created_by: string | null
          employee_code: string | null
          end_date: string | null
          id: string | null
          model_id: string | null
          model_manufacturer: string | null
          model_name: string | null
          model_uuid: string | null
          notes: string | null
          operator_apellido: string | null
          operator_id: string | null
          operator_nombre: string | null
          operator_plant_code: string | null
          operator_plant_id: string | null
          operator_plant_name: string | null
          operator_plant_uuid: string | null
          operator_role: Database["public"]["Enums"]["user_role"] | null
          operator_shift: string | null
          operator_status: string | null
          operator_uuid: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
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
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_operators_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
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
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_operators_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "asset_operators_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["model_uuid"]
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
            columns: ["asset_plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "assets_plant_id_fkey"
            columns: ["asset_plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "assets_plant_id_fkey"
            columns: ["asset_plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "assets_plant_id_fkey"
            columns: ["asset_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["operator_plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["operator_plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["operator_plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["operator_plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      authorization_limits: {
        Row: {
          approver_role: Database["public"]["Enums"]["user_role"] | null
          business_unit_name: string | null
          effective_limit: number | null
          plant_name: string | null
          requires_approval: boolean | null
          role: Database["public"]["Enums"]["user_role"] | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: []
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
      checklist_schedules_status: {
        Row: {
          asset_code: string | null
          asset_id: string | null
          asset_name: string | null
          assigned_to: string | null
          checklist_name: string | null
          created_at: string | null
          created_by: string | null
          days_overdue: number | null
          frequency: string | null
          id: string | null
          location: string | null
          maintenance_plan_id: string | null
          model_name: string | null
          scheduled_date: string | null
          status: string | null
          status_label: string | null
          template_id: string | null
          updated_at: string | null
          updated_by: string | null
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
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
      delegation_details: {
        Row: {
          business_unit_id: string | null
          business_unit_name: string | null
          created_at: string | null
          delegated_amount: number | null
          grantee_apellido: string | null
          grantee_id: string | null
          grantee_nombre: string | null
          grantee_role: Database["public"]["Enums"]["user_role"] | null
          grantor_apellido: string | null
          grantor_id: string | null
          grantor_nombre: string | null
          grantor_role: Database["public"]["Enums"]["user_role"] | null
          id: string | null
          is_active: boolean | null
          notes: string | null
          plant_id: string | null
          plant_name: string | null
          scope_type: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authorization_delegations_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantee_user_id_fkey"
            columns: ["grantee_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "authorization_delegations_grantee_user_id_fkey"
            columns: ["grantee_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantee_user_id_fkey"
            columns: ["grantee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantee_user_id_fkey"
            columns: ["grantee_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantee_user_id_fkey"
            columns: ["grantee_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantee_user_id_fkey"
            columns: ["grantee_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantor_user_id_fkey"
            columns: ["grantor_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "authorization_delegations_grantor_user_id_fkey"
            columns: ["grantor_id"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantor_user_id_fkey"
            columns: ["grantor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantor_user_id_fkey"
            columns: ["grantor_id"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantor_user_id_fkey"
            columns: ["grantor_id"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "authorization_delegations_grantor_user_id_fkey"
            columns: ["grantor_id"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_delegations_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "authorization_delegations_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "authorization_delegations_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "authorization_delegations_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_asset_consumption_by_warehouse: {
        Row: {
          asset_category: string | null
          asset_code: string | null
          asset_id: string | null
          asset_name: string | null
          avg_consumption_per_transaction: number | null
          avg_liters_per_hour_tx: number | null
          avg_liters_per_km_tx: number | null
          consumption_last_30_days: number | null
          exception_asset_name: string | null
          first_consumption: string | null
          last_consumption: string | null
          plant_id: string | null
          plant_name: string | null
          product_type: string | null
          total_consumption: number | null
          transaction_count: number | null
          transactions_last_30_days: number | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diesel_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "diesel_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "diesel_current_inventory"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "diesel_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "diesel_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "monthly_inventory_summary"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_asset_consumption_summary: {
        Row: {
          activity_status: string | null
          asset_category: string | null
          asset_code: string | null
          asset_id: string | null
          asset_name: string | null
          avg_consumption_per_transaction: number | null
          avg_liters_per_hour: number | null
          avg_liters_per_km: number | null
          consumption_last_30_days: number | null
          exception_asset_name: string | null
          first_consumption: string | null
          last_consumption: string | null
          plant_name: string | null
          total_consumption: number | null
          transaction_count: number | null
          transactions_last_30_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diesel_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "diesel_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_current_inventory: {
        Row: {
          calculated_at: string | null
          capacity_liters: number | null
          capacity_percentage: number | null
          current_stock_liters: number | null
          last_consumption_date: string | null
          last_entry_date: string | null
          last_movement_date: string | null
          minimum_stock_level: number | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          product_code: string | null
          product_id: string | null
          stock_status: string | null
          total_consumptions: number | null
          total_entries: number | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_inventory_detailed: {
        Row: {
          adjustments: number | null
          asset_category: string | null
          entries: number | null
          exception_asset_consumption: number | null
          formal_asset_consumption: number | null
          general_consumption: number | null
          movement_date: string | null
          net_movement: number | null
          plant_code: string | null
          plant_id: string | null
          plant_name: string | null
          running_balance: number | null
          transaction_count: number | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diesel_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "diesel_current_inventory"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "diesel_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "diesel_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "monthly_inventory_summary"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_monthly_consumption_by_asset: {
        Row: {
          asset_category: string | null
          asset_id: string | null
          exception_asset_name: string | null
          period_first_tx: string | null
          period_last_tx: string | null
          plant_id: string | null
          total_hours_consumed: number | null
          total_km_consumed: number | null
          total_liters: number | null
          transaction_count: number | null
          warehouse_id: string | null
          warehouse_name: string | null
          year_month: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diesel_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "active_assets_without_recent_inspection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "diesel_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "diesel_current_inventory"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "diesel_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "diesel_warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diesel_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "monthly_inventory_summary"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "diesel_warehouses_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      exception_assets_review: {
        Row: {
          asset_type: string | null
          confidence_level: number | null
          description: string | null
          exception_name: string | null
          first_seen: string | null
          id: string | null
          is_promoted: boolean | null
          last_seen: string | null
          mapping_source: string | null
          mapping_status: string | null
          owner_info: string | null
          promoted_asset_name: string | null
          promoted_at: string | null
          total_consumption_liters: number | null
          total_transactions: number | null
        }
        Relationships: []
      }
      inventory_low_stock_alerts: {
        Row: {
          available_quantity: number | null
          average_unit_cost: number | null
          category: string | null
          current_quantity: number | null
          min_stock_level: number | null
          part_id: string | null
          part_name: string | null
          part_number: string | null
          plant_id: string | null
          plant_name: string | null
          reorder_point: number | null
          reserved_quantity: number | null
          stock_id: string | null
          stock_status: string | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: []
      }
      inventory_stale_reservations: {
        Row: {
          days_reserved: number | null
          movement_id: string | null
          part_name: string | null
          part_number: string | null
          plant_name: string | null
          requested_by: string | null
          reserved_quantity: number | null
          reserved_since: string | null
          warehouse_name: string | null
          work_order_description: string | null
          work_order_id: string | null
          work_order_number: string | null
          work_order_status: string | null
        }
        Relationships: []
      }
      inventory_valuation: {
        Row: {
          plant_name: string | null
          reserved_value: number | null
          total_parts: number | null
          total_reserved_units: number | null
          total_units: number | null
          total_value: number | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: []
      }
      monthly_inventory_summary: {
        Row: {
          adjustment_level: string | null
          month_end_balance: number | null
          month_year: string | null
          monthly_adjustments: number | null
          monthly_consumption: number | null
          monthly_entries: number | null
          net_monthly_change: number | null
          plant_name: string | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
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
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
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
          {
            foreignKeyName: "work_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_expense_classification"
            referencedColumns: ["id"]
          },
        ]
      }
      po_type_summary: {
        Row: {
          approval_rate: number | null
          avg_value: number | null
          po_type: string | null
          quote_rate: number | null
          total_orders: number | null
          total_value: number | null
        }
        Relationships: []
      }
      purchase_order_metrics: {
        Row: {
          approved_count: number | null
          avg_amount: number | null
          completed_count: number | null
          count: number | null
          first_order: string | null
          last_order: string | null
          payment_method: string | null
          plant_id: string | null
          po_type: string | null
          rejected_count: number | null
          total_amount: number | null
          with_quotes: number | null
          without_quotes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders_expense_classification: {
        Row: {
          actual_amount: number | null
          actual_delivery_date: string | null
          adjusted_at: string | null
          adjusted_by: string | null
          adjusted_total_amount: number | null
          adjustment_amount: number | null
          adjustment_reason: string | null
          adjustment_status: string | null
          approval_date: string | null
          approved_by: string | null
          authorization_date: string | null
          authorized_by: string | null
          cash_impact_this_month: number | null
          created_at: string | null
          enhanced_status: string | null
          expected_delivery_date: string | null
          fulfillment_source: string | null
          id: string | null
          inventory_fulfilled: boolean | null
          inventory_fulfilled_by: string | null
          inventory_fulfillment_date: string | null
          inventory_investment: number | null
          inventory_value_consumed: number | null
          invoice_date: string | null
          invoice_number: string | null
          is_adjustment: boolean | null
          items: Json | null
          max_payment_date: string | null
          notes: string | null
          order_id: string | null
          original_purchase_order_id: string | null
          paid_by: string | null
          payment_date: string | null
          payment_method: string | null
          payment_notes: string | null
          payment_reference: string | null
          payment_status: string | null
          plant_id: string | null
          po_purpose: string | null
          po_type: string | null
          posting_date: string | null
          purchase_date: string | null
          purchased_at: string | null
          quotation_url: string | null
          quotation_urls: Json | null
          quote_required_reason: string | null
          receipt_uploaded: boolean | null
          received_items_summary: Json | null
          received_to_inventory: boolean | null
          received_to_inventory_by: string | null
          received_to_inventory_date: string | null
          requested_by: string | null
          requires_adjustment: boolean | null
          requires_approval: boolean | null
          requires_quote: boolean | null
          service_provider: string | null
          status: string | null
          store_location: string | null
          supplier: string | null
          supplier_id: string | null
          total_amount: number | null
          updated_at: string | null
          updated_by: string | null
          work_order_id: string | null
        }
        Insert: {
          actual_amount?: number | null
          actual_delivery_date?: string | null
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjusted_total_amount?: number | null
          adjustment_amount?: number | null
          adjustment_reason?: string | null
          adjustment_status?: string | null
          approval_date?: string | null
          approved_by?: string | null
          authorization_date?: string | null
          authorized_by?: string | null
          cash_impact_this_month?: never
          created_at?: string | null
          enhanced_status?: string | null
          expected_delivery_date?: string | null
          fulfillment_source?: string | null
          id?: string | null
          inventory_fulfilled?: boolean | null
          inventory_fulfilled_by?: string | null
          inventory_fulfillment_date?: string | null
          inventory_investment?: never
          inventory_value_consumed?: never
          invoice_date?: string | null
          invoice_number?: string | null
          is_adjustment?: boolean | null
          items?: Json | null
          max_payment_date?: string | null
          notes?: string | null
          order_id?: string | null
          original_purchase_order_id?: string | null
          paid_by?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          plant_id?: string | null
          po_purpose?: string | null
          po_type?: string | null
          posting_date?: string | null
          purchase_date?: string | null
          purchased_at?: string | null
          quotation_url?: string | null
          quotation_urls?: Json | null
          quote_required_reason?: string | null
          receipt_uploaded?: boolean | null
          received_items_summary?: Json | null
          received_to_inventory?: boolean | null
          received_to_inventory_by?: string | null
          received_to_inventory_date?: string | null
          requested_by?: string | null
          requires_adjustment?: boolean | null
          requires_approval?: boolean | null
          requires_quote?: boolean | null
          service_provider?: string | null
          status?: string | null
          store_location?: string | null
          supplier?: string | null
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          actual_amount?: number | null
          actual_delivery_date?: string | null
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjusted_total_amount?: number | null
          adjustment_amount?: number | null
          adjustment_reason?: string | null
          adjustment_status?: string | null
          approval_date?: string | null
          approved_by?: string | null
          authorization_date?: string | null
          authorized_by?: string | null
          cash_impact_this_month?: never
          created_at?: string | null
          enhanced_status?: string | null
          expected_delivery_date?: string | null
          fulfillment_source?: string | null
          id?: string | null
          inventory_fulfilled?: boolean | null
          inventory_fulfilled_by?: string | null
          inventory_fulfillment_date?: string | null
          inventory_investment?: never
          inventory_value_consumed?: never
          invoice_date?: string | null
          invoice_number?: string | null
          is_adjustment?: boolean | null
          items?: Json | null
          max_payment_date?: string | null
          notes?: string | null
          order_id?: string | null
          original_purchase_order_id?: string | null
          paid_by?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_notes?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          plant_id?: string | null
          po_purpose?: string | null
          po_type?: string | null
          posting_date?: string | null
          purchase_date?: string | null
          purchased_at?: string | null
          quotation_url?: string | null
          quotation_urls?: Json | null
          quote_required_reason?: string | null
          receipt_uploaded?: boolean | null
          received_items_summary?: Json | null
          received_to_inventory?: boolean | null
          received_to_inventory_by?: string | null
          received_to_inventory_date?: string | null
          requested_by?: string | null
          requires_adjustment?: boolean | null
          requires_approval?: boolean | null
          requires_quote?: boolean | null
          service_provider?: string | null
          status?: string | null
          store_location?: string | null
          supplier?: string | null
          supplier_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
          updated_by?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_original_purchase_order_id_fkey"
            columns: ["original_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_original_purchase_order_id_fkey"
            columns: ["original_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_original_purchase_order_id_fkey"
            columns: ["original_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_expense_classification"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_uuid"]
          },
          {
            foreignKeyName: "purchase_orders_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "authorization_limits"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "user_authorization_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "user_plants_expanded"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "user_roles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "purchase_orders_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "inventory_stale_reservations"
            referencedColumns: ["work_order_id"]
          },
          {
            foreignKeyName: "purchase_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_with_checklist_status"
            referencedColumns: ["id"]
          },
        ]
      }
      rls_final_status: {
        Row: {
          policies: unknown[] | null
          policy_count: number | null
          policy_roles: unknown[] | null
          rls_enabled: boolean | null
          tablename: unknown
        }
        Relationships: []
      }
      rls_implementation_summary: {
        Row: {
          access_functions: number | null
          active_users: number | null
          business_units: number | null
          completed_at: string | null
          feature: string | null
          plants: number | null
          status: string | null
          total_assets: number | null
          total_policies: number | null
        }
        Relationships: []
      }
      rls_system_complete_status: {
        Row: {
          policy_count: number | null
          rls_enabled: boolean | null
          roles_covered: string[] | null
          status_rls: string | null
          tablename: unknown
        }
        Relationships: []
      }
      user_authorization_summary: {
        Row: {
          active_delegations_given: number | null
          active_delegations_received: number | null
          apellido: string | null
          authorization_type: string | null
          available_delegation_amount: number | null
          business_unit_id: string | null
          business_unit_max_limit: number | null
          business_unit_name: string | null
          effective_global_authorization: number | null
          email: string | null
          individual_limit: number | null
          nombre: string | null
          plant_id: string | null
          plant_name: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          total_delegated_in: number | null
          total_delegated_out: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_plant_uuid"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "asset_operators_full"
            referencedColumns: ["operator_plant_uuid"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "inventory_low_stock_alerts"
            referencedColumns: ["plant_id"]
          },
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plants_expanded: {
        Row: {
          business_unit_id: string | null
          business_unit_name: string | null
          plant_id: string | null
          plant_name: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles_summary: {
        Row: {
          apellido: string | null
          business_unit_name: string | null
          can_authorize_up_to: number | null
          employee_code: string | null
          hire_date: string | null
          id: string | null
          nombre: string | null
          phone_secondary: string | null
          plant_name: string | null
          position: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          status: string | null
          telefono: string | null
        }
        Relationships: []
      }
      work_orders_with_checklist_status: {
        Row: {
          approval_date: string | null
          approval_status: string | null
          approved_by: string | null
          asset_id: string | null
          assigned_to: string | null
          checklist_id: string | null
          checklist_status: string | null
          completed_at: string | null
          completion_photos: Json | null
          created_at: string | null
          creation_photos: Json | null
          description: string | null
          estimated_cost: number | null
          estimated_duration: number | null
          id: string | null
          incident_id: string | null
          issue_items: Json | null
          maintenance_plan_id: string | null
          order_id: string | null
          planned_date: string | null
          preventive_checklist_completed: boolean | null
          preventive_checklist_id: string | null
          priority: string | null
          progress_photos: Json | null
          purchase_order_id: string | null
          purchase_order_status: string | null
          ready_to_execute: boolean | null
          requested_by: string | null
          required_parts: Json | null
          service_order_id: string | null
          status: string | null
          type: string | null
          updated_at: string | null
          updated_by: string | null
          used_parts: Json | null
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
            referencedRelation: "asset_operators_full"
            referencedColumns: ["asset_uuid"]
          },
          {
            foreignKeyName: "work_orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incident_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_preventive_checklist_id_fkey"
            columns: ["preventive_checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders_expense_classification"
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
    Functions: {
      add_column_if_not_exists: {
        Args: {
          p_column: string
          p_constraint?: string
          p_table: string
          p_type: string
        }
        Returns: undefined
      }
      advance_purchase_order_workflow:
        | {
            Args: {
              p_new_status: string
              p_purchase_order_id: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_new_status: string
              p_notes?: string
              p_purchase_order_id: string
              p_user_id: string
            }
            Returns: Json
          }
      apply_supplier_verification_event: {
        Args: {
          p_action: string
          p_checklist_snapshot: Json
          p_new_status: string
          p_notes: string
          p_supplier_id: string
        }
        Returns: undefined
      }
      approve_additional_expense: {
        Args: { p_approved_by: string; p_expense_id: string }
        Returns: boolean
      }
      approve_purchase_order: {
        Args: { p_approved_by: string; p_purchase_order_id: string }
        Returns: undefined
      }
      assign_operator_to_asset: {
        Args: {
          asset_uuid: string
          assigned_by_uuid: string
          assignment_type_param: string
          operator_uuid: string
          start_date_param?: string
        }
        Returns: Json
      }
      audit_warehouse_balance: {
        Args: { p_warehouse_id: string }
        Returns: Json
      }
      auto_approve_additional_expense: {
        Args: { p_approved_by: string; p_expense_id: string }
        Returns: boolean
      }
      auto_create_pending_work_orders: { Args: never; Returns: Json }
      auto_create_pending_work_orders_with_logging: {
        Args: never
        Returns: undefined
      }
      backfill_po_notifications: {
        Args: never
        Returns: {
          error_message: string
          notification_sent: boolean
          order_id: string
          po_id: string
        }[]
      }
      calculate_actual_due_hour: {
        Args: {
          cycle_length_hours: number
          cycle_number: number
          interval_hours: number
          is_first_cycle_only?: boolean
        }
        Returns: number
      }
      calculate_escalated_priority: {
        Args: {
          p_original_priority: string
          p_recurrence_count: number
          p_status: string
        }
        Returns: string
      }
      calculate_maintenance_cycle: {
        Args: { asset_current_hours: number; cycle_length_hours: number }
        Returns: number
      }
      calculate_next_maintenance: {
        Args: { p_asset_id: string; p_maintenance_interval: number }
        Returns: string
      }
      call_refresh_ingresos_kpi_rollup: { Args: never; Returns: undefined }
      can_asset_operate: { Args: { p_asset_id: string }; Returns: boolean }
      can_manage_user: { Args: { target_user_id: string }; Returns: boolean }
      can_user_access_plant: {
        Args: { p_plant_id: string; p_user_id: string }
        Returns: boolean
      }
      can_user_authorize_purchase_order: {
        Args: {
          p_amount: number
          p_business_unit_id?: string
          p_plant_id?: string
          p_user_id: string
        }
        Returns: boolean
      }
      can_user_delegate: {
        Args: {
          p_amount: number
          p_business_unit_id?: string
          p_grantee_id: string
          p_grantor_id: string
          p_plant_id?: string
        }
        Returns: boolean
      }
      check_existing_schedule: {
        Args: {
          p_asset_id: string
          p_scheduled_date: string
          p_template_id: string
        }
        Returns: boolean
      }
      check_maintenance_due_assets: {
        Args: never
        Returns: {
          asset_id: string
          asset_name: string
          days_remaining: number
          maintenance_plan_id: string
          maintenance_unit: string
          next_due: string
          plan_name: string
          value_remaining: number
        }[]
      }
      check_quotation_selection_required: {
        Args: { p_po_id: string }
        Returns: boolean
      }
      cleanup_all_duplicate_schedules: { Args: never; Returns: number }
      cleanup_duplicate_schedules: { Args: never; Returns: number }
      cleanup_duplicate_work_order_ids: {
        Args: never
        Returns: {
          errors: string
          fixed_count: number
        }[]
      }
      complete_checklist_with_readings: {
        Args: {
          p_completed_items: Json
          p_hours_reading?: number
          p_kilometers_reading?: number
          p_notes?: string
          p_schedule_id: string
          p_signature_data?: string
          p_technician: string
        }
        Returns: Json
      }
      complete_maintenance: {
        Args: {
          p_actions: string
          p_completion_date: string
          p_documents?: string[]
          p_findings: string
          p_labor_cost: number
          p_labor_hours: number
          p_maintenance_id: string
          p_measurement_value: number
          p_parts: Json
          p_technician: string
          p_total_cost: number
        }
        Returns: string
      }
      complete_work_order: {
        Args: { p_completion_data: Json; p_work_order_id: string }
        Returns: string
      }
      consolidate_issues: {
        Args: {
          p_existing_issue_id: string
          p_new_issue_id: string
          p_work_order_id: string
        }
        Returns: boolean
      }
      convert_units: {
        Args: { p_from_unit: string; p_quantity: number; p_to_unit: string }
        Returns: number
      }
      create_asset_mapping: {
        Args: {
          p_asset_id?: string
          p_created_by?: string
          p_exception_asset_id?: string
          p_mapping_type?: string
          p_original_name: string
        }
        Returns: boolean
      }
      create_incident_from_checklist_issue: {
        Args: { p_checklist_issue_id: string }
        Returns: string
      }
      create_template_version: {
        Args: {
          p_change_summary?: string
          p_migration_notes?: string
          p_template_id: string
        }
        Returns: string
      }
      diesel_analytics_assets_in_period: {
        Args: {
          p_from?: string
          p_plant_ids?: string[]
          p_to?: string
          p_warehouse_id?: string
        }
        Returns: {
          asset_category: string
          asset_code: string
          asset_id: string
          asset_name: string
          avg_consumption_per_transaction: number
          exception_asset_name: string
          first_consumption: string
          last_consumption: string
          plant_id: string
          plant_name: string
          sum_hours_consumed: number
          sum_km_consumed: number
          total_consumption: number
          transaction_count: number
          warehouse_id: string
          warehouse_name: string
        }[]
      }
      diesel_analytics_overview_totals: {
        Args: { p_from?: string; p_plant_ids?: string[]; p_to?: string }
        Returns: Json
      }
      diesel_analytics_warehouse_period: {
        Args: { p_from?: string; p_plant_ids?: string[]; p_to?: string }
        Returns: {
          consumption_liters: number
          entry_liters: number
          net_flow: number
          plant_id: string
          plant_name: string
          warehouse_id: string
          warehouse_name: string
        }[]
      }
      ensure_asset_uuid: {
        Args: { p_asset_reference: string }
        Returns: string
      }
      escalate_forgotten_assets: { Args: never; Returns: undefined }
      find_missing_weekly_schedules: {
        Args: { p_date?: string; p_days?: number; p_template_id: string }
        Returns: {
          asset_id: string
          asset_name: string
          has_today_schedule: boolean
          last_completed_at: string
        }[]
      }
      find_similar_open_issues: {
        Args: {
          p_asset_id: string
          p_consolidation_window?: string
          p_fingerprint: string
        }
        Returns: {
          created_at: string
          issue_id: string
          item_description: string
          notes: string
          priority: string
          recurrence_count: number
          work_order_id: string
        }[]
      }
      fix_duplicate_order_ids: { Args: never; Returns: string }
      fix_inventory_movement_costs: {
        Args: never
        Returns: {
          movement_id: string
          new_total_cost: number
          new_unit_cost: number
          old_total_cost: number
          old_unit_cost: number
          part_id: string
          part_name: string
          part_number: string
          source: string
        }[]
      }
      fix_inventory_po_statuses: {
        Args: never
        Returns: {
          new_status: string
          old_status: string
          order_id: string
          po_id: string
          reason: string
        }[]
      }
      fix_legacy_payment_dates: { Args: never; Returns: number }
      fix_legacy_quotation_issues: { Args: never; Returns: number }
      fix_recent_payment_date_issues: { Args: never; Returns: number }
      generate_adjustment_purchase_order: {
        Args: {
          p_items: Json
          p_original_po_id?: string
          p_requested_by: string
          p_supplier: string
          p_work_order_id: string
        }
        Returns: string
      }
      generate_checklists_from_maintenance_plan: {
        Args: {
          assigned_to: string
          maintenance_plan_id: string
          scheduled_date: string
        }
        Returns: string[]
      }
      generate_corrective_work_order_enhanced: {
        Args: { p_checklist_id: string }
        Returns: string
      }
      generate_diesel_transaction_id: { Args: never; Returns: string }
      generate_inventory_receipt_number: {
        Args: { po_order_id: string }
        Returns: string
      }
      generate_issue_fingerprint: {
        Args: {
          p_asset_id: string
          p_item_description: string
          p_notes?: string
          p_status?: string
        }
        Returns: string
      }
      generate_maintenance_plans: {
        Args: { p_asset_id: string }
        Returns: undefined
      }
      generate_next_id: { Args: { prefix: string }; Returns: string }
      generate_order_id: { Args: { order_type: string }; Returns: string }
      generate_preventive_work_order: {
        Args: { p_asset_id: string; p_maintenance_plan_id: string }
        Returns: string
      }
      generate_purchase_order: {
        Args: {
          p_expected_delivery_date: string
          p_items: Json
          p_quotation_url?: string
          p_requested_by: string
          p_supplier: string
          p_work_order_id: string
        }
        Returns: string
      }
      generate_unique_purchase_order_id: { Args: never; Returns: string }
      generate_unique_work_order_id: { Args: never; Returns: string }
      generate_work_order_from_incident: {
        Args: { p_incident_id: string; p_priority?: string }
        Returns: string
      }
      get_active_template_version: {
        Args: { p_template_id: string }
        Returns: string
      }
      get_admin_summary_simple: {
        Args: never
        Returns: {
          cantidad: number
          nivel: string
          usuarios: string
        }[]
      }
      get_administration_summary: {
        Args: never
        Returns: {
          admin_level: string
          count_users: number
          summary_type: string
          users_list: string
        }[]
      }
      get_allowed_assignments: {
        Args: never
        Returns: {
          assignment_type: string
          business_unit_id: string
          business_unit_name: string
          plant_id: string
          plant_name: string
        }[]
      }
      get_allowed_statuses:
        | {
            Args: { p_po_purpose?: string; p_po_type: string }
            Returns: string[]
          }
        | { Args: { p_po_type: string }; Returns: string[] }
      get_applicable_maintenance_intervals: {
        Args: { p_asset_id: string; p_current_hours: number }
        Returns: {
          current_cycle: number
          cycle_length: number
          description: string
          interval_id: string
          interval_value: number
          is_first_cycle_only: boolean
          is_recurring: boolean
          maintenance_category: string
          name: string
          next_due_hour: number
          status: string
          type: string
        }[]
      }
      get_asset_assignments: {
        Args: { target_asset_id: string }
        Returns: {
          assigned_by_name: string
          assignment_id: string
          assignment_type: string
          employee_code: string
          end_date: string
          operator_id: string
          operator_name: string
          phone: string
          start_date: string
          status: string
        }[]
      }
      get_available_operators: {
        Args: { p_business_unit_id?: string; p_plant_id?: string }
        Returns: {
          apellido: string
          business_unit_id: string
          business_unit_name: string
          email: string
          employee_code: string
          id: string
          is_operator: boolean
          nombre: string
          plant_id: string
          plant_name: string
          role: string
          shift: string
          status: string
        }[]
      }
      get_available_operators_for_plant: {
        Args: { target_plant_id: string }
        Returns: {
          current_primary_assets: number
          current_secondary_assets: number
          employee_code: string
          is_available: boolean
          job_position: string
          operator_id: string
          operator_name: string
          phone: string
          role: Database["public"]["Enums"]["user_role"]
          shift: string
        }[]
      }
      get_daily_checklist_evening_report: {
        Args: { target_date: string }
        Returns: {
          asset_performance: Json
          avg_completion_time_hours: number
          completion_rate: number
          critical_issues: number
          incomplete_checklists: Json
          issues_found: number
          technician_performance: Json
          total_completed: number
          total_scheduled: number
          work_orders_generated: number
        }[]
      }
      get_daily_checklist_morning_report: {
        Args: { target_date: string }
        Returns: {
          asset_code: string
          asset_current_hours: number
          asset_current_kilometers: number
          asset_name: string
          assigned_technician: string
          checklist_name: string
          department_name: string
          estimated_duration: number
          last_completion_date: string
          maintenance_status: string
          plant_name: string
          schedule_id: string
          scheduled_time: string
          status: string
          technician_id: string
          technician_workload: number
        }[]
      }
      get_daily_work_orders_incidents_report: {
        Args: { target_date: string }
        Returns: {
          incidents_created: Json
          purchase_orders_pending: Json
          total_incidents_created: number
          total_work_orders_completed: number
          total_work_orders_created: number
          work_orders_completed: Json
          work_orders_created: Json
        }[]
      }
      get_diesel_backdating_threshold_minutes: { Args: never; Returns: number }
      get_expected_next_reading: {
        Args: { p_asset_id: string; p_reading_type?: string }
        Returns: Json
      }
      get_maintenance_alerts_report: {
        Args: never
        Returns: {
          asset_code: string
          asset_id: string
          asset_name: string
          current_asset_hours: number
          current_asset_kilometers: number
          days_until_due: number
          estimated_duration: number
          hours_until_due: number
          interval_value: number
          kilometers_until_due: number
          last_completed: string
          last_service_date: string
          last_service_hours: number
          last_service_kilometers: number
          maintenance_type: string
          maintenance_unit: string
          overdue_amount: number
          plant_name: string
          risk_level: string
          workdays_until_due: number
        }[]
      }
      get_maintenance_intervals_with_tasks: {
        Args: { p_model_id: string }
        Returns: Json
      }
      get_manageable_users: {
        Args: never
        Returns: {
          admin_level: string
          apellido: string
          business_unit_name: string
          can_edit: boolean
          email: string
          nombre: string
          plant_name: string
          role: Database["public"]["Enums"]["user_role"]
          status: string
          user_id: string
        }[]
      }
      get_model_cycle_length: { Args: { p_model_id: string }; Returns: number }
      get_po_action_token:
        | {
            Args: {
              p_action: string
              p_po_id: string
              p_recipient_email: string
            }
            Returns: string
          }
        | {
            Args: {
              p_action: string
              p_po_id: string
              p_quotation_id?: string
              p_recipient_email: string
            }
            Returns: string
          }
      get_profile_id_by_email: { Args: { p_email: string }; Returns: string }
      get_purchase_order_approver: {
        Args: {
          p_amount: number
          p_business_unit_id?: string
          p_plant_id?: string
        }
        Returns: string
      }
      get_purchase_order_authorizers: {
        Args: {
          p_amount: number
          p_business_unit_id?: string
          p_plant_id?: string
        }
        Returns: {
          apellido: string
          authorization_source: string
          effective_authorization: number
          nombre: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }[]
      }
      get_required_checklist_for_work_order: {
        Args: { p_work_order_id: string }
        Returns: string
      }
      get_schedule_statistics: {
        Args: never
        Returns: {
          assets_with_schedules: number
          completed_schedules: number
          duplicate_groups: number
          pending_schedules: number
          total_schedules: number
        }[]
      }
      get_supplier_suggestions_fast: {
        Args: {
          p_asset_category?: string
          p_limit?: number
          p_location?: string
        }
        Returns: {
          avg_delivery_time: number
          avg_order_amount: number
          business_name: string
          city: string
          contact_person: string
          email: string
          id: string
          name: string
          phone: string
          rating: number
          reliability_score: number
          specialties: string[]
          state: string
          supplier_type: string
          total_orders: number
        }[]
      }
      get_truly_unresolved_checklist_issues: {
        Args: never
        Returns: {
          asset_code: string
          asset_id: string
          asset_name: string
          asset_uuid: string
          checklist_id: string
          completed_checklist_id: string
          completion_date: string
          created_at: string
          description: string
          id: string
          item_id: string
          notes: string
          photo_url: string
          status: string
          technician: string
        }[]
      }
      get_unmapped_assets: {
        Args: never
        Returns: {
          confidence_score: number
          occurrence_count: number
          original_name: string
          suggested_asset_id: string
          suggested_asset_name: string
        }[]
      }
      get_user_delegatable_amount: {
        Args: {
          p_business_unit_id?: string
          p_plant_id?: string
          p_user_id: string
        }
        Returns: number
      }
      get_user_effective_authorization: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_valid_next_statuses:
        | {
            Args: { p_current_status: string; p_po_type: string }
            Returns: string[]
          }
        | {
            Args: {
              p_current_status: string
              p_po_purpose?: string
              p_po_type: string
            }
            Returns: string[]
          }
      get_warehouse_balance: {
        Args: { p_as_of_date?: string; p_warehouse_id: string }
        Returns: number
      }
      get_warehouse_current_balance: {
        Args: { p_warehouse_id: string }
        Returns: number
      }
      has_quotations: {
        Args: { p_purchase_order_id: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_supplier_non_jefe_padron_editor: {
        Args: { p_uid: string }
        Returns: boolean
      }
      is_supplier_padron_viewer: { Args: { p_uid: string }; Returns: boolean }
      is_work_order_ready_to_execute: {
        Args: { p_work_order_id: string }
        Returns: boolean
      }
      jefe_may_create_supplier: {
        Args: { p_bu_id: string; p_serves_all: boolean; p_uid: string }
        Returns: boolean
      }
      jefe_may_write_supplier: {
        Args: { p_supplier_id: string; p_uid: string }
        Returns: boolean
      }
      jefe_may_write_supplier_bu: {
        Args: { p_bu_to_write: string; p_supplier_id: string; p_uid: string }
        Returns: boolean
      }
      log_cron_selftest: { Args: { p_job: string }; Returns: undefined }
      mark_checklist_as_completed: {
        Args: {
          p_completed_items: Json
          p_notes?: string
          p_schedule_id: string
          p_signature_data?: string
          p_technician: string
        }
        Returns: Json
      }
      mark_checklist_as_completed_versioned: {
        Args: {
          p_completed_items: Json
          p_notes?: string
          p_schedule_id: string
          p_signature_data?: string
          p_technician: string
        }
        Returns: Json
      }
      migrate_all_legacy_quotations: {
        Args: { p_limit?: number }
        Returns: Json
      }
      migrate_legacy_quotation: { Args: { p_po_id: string }; Returns: Json }
      next_valid_daily_date: { Args: { p_date: string }; Returns: string }
      next_valid_date: {
        Args: { p_date: string; p_frequency: string }
        Returns: string
      }
      normalize_asset_name: { Args: { input_name: string }; Returns: string }
      po_resolve_workflow_path: {
        Args: {
          p_approval_amount: number
          p_po_purpose: string
          p_work_order_type: string
        }
        Returns: Json
      }
      process_checklist_completion_enhanced: {
        Args: {
          p_completed_items: Json
          p_equipment_hours_reading?: number
          p_equipment_kilometers_reading?: number
          p_notes?: string
          p_schedule_id: string
          p_signature_data?: string
          p_technician: string
        }
        Returns: Json
      }
      process_po_email_action: { Args: { p_token: string }; Returns: Json }
      profile_scoped_plant_ids: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      purchase_orders_by_work_order_ids: {
        Args: { p_work_order_ids: string[] }
        Returns: {
          id: string
          order_id: string
          status: string
          work_order_id: string
        }[]
      }
      purchase_orders_id_status_by_ids: {
        Args: { p_ids: string[] }
        Returns: {
          id: string
          status: string
        }[]
      }
      recalc_balances_from: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      recalculate_warehouse_balances: {
        Args: { p_warehouse_id: string }
        Returns: Json
      }
      recalculate_warehouse_balances_v3: {
        Args: { p_initial_balance?: number; p_warehouse_id: string }
        Returns: Json
      }
      recalculate_warehouse_balances_with_initial: {
        Args: { p_initial_balance?: number; p_warehouse_id: string }
        Returns: Json
      }
      reconcile_diesel_inventory: {
        Args: {
          p_count_date: string
          p_created_by: string
          p_physical_count: number
          p_reason: string
          p_warehouse_id: string
        }
        Returns: string
      }
      recover_from_duplicate_work_order_id: { Args: never; Returns: string }
      recover_missing_weekly_schedules: {
        Args: { p_date?: string; p_days?: number; p_template_id: string }
        Returns: number
      }
      refresh_asset_accountability: { Args: never; Returns: undefined }
      refresh_diesel_inventory: { Args: never; Returns: undefined }
      reject_additional_expense: {
        Args: {
          p_expense_id: string
          p_rejected_by: string
          p_rejection_reason: string
        }
        Returns: boolean
      }
      requires_quotation: {
        Args: { p_amount: number; p_po_purpose?: string; p_po_type: string }
        Returns: boolean
      }
      reschedule_checklist: {
        Args: { p_new_day: string; p_schedule_id: string; p_updated_by: string }
        Returns: Json
      }
      reschedule_overdue_checklists: { Args: never; Returns: number }
      resolve_asset_name: {
        Args: { auto_create_exception?: boolean; input_name: string }
        Returns: {
          asset_category: string
          asset_id: string
          exception_asset_id: string
          resolution_type: string
        }[]
      }
      restore_template_version: {
        Args: { p_version_id: string }
        Returns: boolean
      }
      rls_complete_system_check: {
        Args: never
        Returns: {
          component: string
          count_result: number
          details: string
          status: string
        }[]
      }
      rls_health_check: {
        Args: never
        Returns: {
          component: string
          details: string
          status: string
        }[]
      }
      rls_system_health_check: {
        Args: never
        Returns: {
          component: string
          count_result: number
          details: string
          status: string
        }[]
      }
      rpc_get_supplier_suggestions: {
        Args: {
          asset_id?: string
          budget_max?: number
          budget_min?: number
          problem_description?: string
          request_limit?: number
          required_services?: string
          urgency?: string
          work_order_id?: string
        }
        Returns: Json
      }
      save_checklist_evidence: {
        Args: { p_completed_checklist_id: string; p_evidence_data: Json }
        Returns: Json
      }
      select_quotation: {
        Args: {
          p_quotation_id: string
          p_selection_reason?: string
          p_user_id: string
        }
        Returns: Json
      }
      should_allow_purchase_order_generation: {
        Args: { p_work_order_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      supplier_insert_allowed: {
        Args: { p_bu_id: string; p_serves_all: boolean; p_uid: string }
        Returns: boolean
      }
      supplier_may_write: {
        Args: { p_supplier_id: string; p_uid: string }
        Returns: boolean
      }
      sync_warehouse_balance: {
        Args: { p_warehouse_id: string }
        Returns: undefined
      }
      sync_warehouse_balance_v2: {
        Args: { p_warehouse_id: string }
        Returns: undefined
      }
      test_user_access_simplified: {
        Args: { p_user_email: string }
        Returns: {
          access_level: string
          asset_count: number
          business_unit_access: string[]
          can_see_all_profiles: boolean
          plant_access: string[]
        }[]
      }
      transfer_operator_assignment: {
        Args: {
          p_assignment_type?: string
          p_force_transfer?: boolean
          p_from_asset_id?: string
          p_operator_id: string
          p_to_asset_id: string
          p_transfer_reason?: string
          p_user_id: string
        }
        Returns: Json
      }
      update_asset_readings_from_checklist: {
        Args: {
          p_completed_checklist_id: string
          p_hours_reading?: number
          p_kilometers_reading?: number
        }
        Returns: Json
      }
      update_exception_asset_stats: { Args: never; Returns: undefined }
      update_existing_issue_fingerprints: { Args: never; Returns: number }
      update_maintenance_plan_after_completion: {
        Args: {
          p_asset_id: string
          p_completion_date: string
          p_interval_value: number
        }
        Returns: undefined
      }
      update_quotation_selection_status: {
        Args: { p_po_id: string }
        Returns: undefined
      }
      update_transaction_with_recalculation: {
        Args: {
          p_new_cuenta_litros?: number
          p_new_date: string
          p_new_quantity: number
          p_transaction_id: string
        }
        Returns: Json
      }
      user_can_insert_asset: {
        Args: { p_new_plant_id: string }
        Returns: boolean
      }
      user_can_update_asset_plant: {
        Args: { p_asset_id: string; p_new_plant_id: string }
        Returns: boolean
      }
      user_has_warehouse_permission: {
        Args: {
          p_permission: string
          p_user_id: string
          p_warehouse_id: string
        }
        Returns: boolean
      }
      validate_equipment_readings: {
        Args: {
          p_asset_id: string
          p_hours_reading?: number
          p_kilometers_reading?: number
        }
        Returns: Json
      }
      validate_evidence_requirements: {
        Args: { p_completed_checklist_id: string; p_evidence_data: Json }
        Returns: Json
      }
      validate_schedule_integrity: {
        Args: never
        Returns: {
          asset_id: string
          count: number
          date_only: string
          issue_type: string
          status: string
          template_id: string
        }[]
      }
    }
    Enums: {
      assignment_type: "primary" | "secondary"
      user_role:
        | "GERENCIA_GENERAL"
        | "JEFE_UNIDAD_NEGOCIO"
        | "ENCARGADO_MANTENIMIENTO"
        | "JEFE_PLANTA"
        | "DOSIFICADOR"
        | "OPERADOR"
        | "AUXILIAR_COMPRAS"
        | "AREA_ADMINISTRATIVA"
        | "EJECUTIVO"
        | "VISUALIZADOR"
        | "ENCARGADO_ALMACEN"
        | "GERENTE_MANTENIMIENTO"
        | "COORDINADOR_MANTENIMIENTO"
        | "MECANICO"
        | "RECURSOS_HUMANOS"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      assignment_type: ["primary", "secondary"],
      user_role: [
        "GERENCIA_GENERAL",
        "JEFE_UNIDAD_NEGOCIO",
        "ENCARGADO_MANTENIMIENTO",
        "JEFE_PLANTA",
        "DOSIFICADOR",
        "OPERADOR",
        "AUXILIAR_COMPRAS",
        "AREA_ADMINISTRATIVA",
        "EJECUTIVO",
        "VISUALIZADOR",
        "ENCARGADO_ALMACEN",
        "GERENTE_MANTENIMIENTO",
        "COORDINADOR_MANTENIMIENTO",
        "MECANICO",
        "RECURSOS_HUMANOS",
      ],
    },
  },
} as const
