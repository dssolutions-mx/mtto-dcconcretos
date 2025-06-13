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
        ]
      }
      profiles: {
        Row: {
          apellido: string | null
          avatar_url: string | null
          business_unit_id: string | null
          can_authorize_up_to: number | null
          certificaciones: string[] | null
          created_at: string
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
          is_operator: boolean | null
          nivel_educacion: string | null
          nombre: string | null
          notas_rh: string | null
          phone_secondary: string | null
          plant_id: string | null
          position: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          shift: string | null
          status: string | null
          telefono: string | null
          tipo_contrato: string | null
          updated_at: string
        }
        Insert: {
          apellido?: string | null
          avatar_url?: string | null
          business_unit_id?: string | null
          can_authorize_up_to?: number | null
          certificaciones?: string[] | null
          created_at?: string
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
          is_operator?: boolean | null
          nivel_educacion?: string | null
          nombre?: string | null
          notas_rh?: string | null
          phone_secondary?: string | null
          plant_id?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          shift?: string | null
          status?: string | null
          telefono?: string | null
          tipo_contrato?: string | null
          updated_at?: string
        }
        Update: {
          apellido?: string | null
          avatar_url?: string | null
          business_unit_id?: string | null
          can_authorize_up_to?: number | null
          certificaciones?: string[] | null
          created_at?: string
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
          is_operator?: boolean | null
          nivel_educacion?: string | null
          nombre?: string | null
          notas_rh?: string | null
          phone_secondary?: string | null
          plant_id?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          shift?: string | null
          status?: string | null
          telefono?: string | null
          tipo_contrato?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_plant_id_fkey"
            columns: ["plant_id"]
            isOneToOne: false
            referencedRelation: "plants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {}
    Functions: {}
    Enums: {
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
 