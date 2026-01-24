import { Database } from './supabase-types';

// Alias para tipos de tablas
export type DbTables = Database['public']['Tables'];

// Tipos para modelos de equipos
export type EquipmentModel = DbTables['equipment_models']['Row'];
export type InsertEquipmentModel = DbTables['equipment_models']['Insert'];
export type UpdateEquipmentModel = DbTables['equipment_models']['Update'];

// Tipos para intervalos de mantenimiento
export type MaintenanceInterval = DbTables['maintenance_intervals']['Row'] & {
  maintenance_tasks?: MaintenanceTask[];
};
export type InsertMaintenanceInterval = DbTables['maintenance_intervals']['Insert'];
export type UpdateMaintenanceInterval = DbTables['maintenance_intervals']['Update'];

// Ya definidos más abajo

// Tipos para tareas de mantenimiento
export type MaintenanceTask = DbTables['maintenance_tasks']['Row'] & {
  task_parts?: TaskPart[];
};
export type InsertMaintenanceTask = DbTables['maintenance_tasks']['Insert'];
export type UpdateMaintenanceTask = DbTables['maintenance_tasks']['Update'];

// Tipos para repuestos de tareas
export type TaskPart = DbTables['task_parts']['Row'];
export type InsertTaskPart = DbTables['task_parts']['Insert'];
export type UpdateTaskPart = DbTables['task_parts']['Update'];

// Tipos para documentación de modelos
export type ModelDocumentation = DbTables['model_documentation']['Row'];
export type InsertModelDocumentation = DbTables['model_documentation']['Insert'];
export type UpdateModelDocumentation = DbTables['model_documentation']['Update'];

// Tipos para activos
export type Asset = DbTables['assets']['Row'];
export type InsertAsset = DbTables['assets']['Insert'];
export type UpdateAsset = DbTables['assets']['Update'];

// Tipos para unidades de negocio
export type BusinessUnit = DbTables['business_units']['Row'];
export type InsertBusinessUnit = DbTables['business_units']['Insert'];
export type UpdateBusinessUnit = DbTables['business_units']['Update'];

// Tipos para plantas
export type Plant = DbTables['plants']['Row'] & {
  business_unit?: BusinessUnit;
};
export type InsertPlant = DbTables['plants']['Insert'];
export type UpdatePlant = DbTables['plants']['Update'];

// Tipos para departamentos
export type Department = DbTables['departments']['Row'] & {
  plant?: Plant;
};
export type InsertDepartment = DbTables['departments']['Insert'];
export type UpdateDepartment = DbTables['departments']['Update'];

// Tipos para operadores de activos (Phase 2)
export type AssetOperator = DbTables['asset_operators']['Row'] & {
  asset?: Asset;
  operator?: Profile;
  assigned_by_profile?: Profile;
};
export type InsertAssetOperator = DbTables['asset_operators']['Insert'];
export type UpdateAssetOperator = DbTables['asset_operators']['Update'];

// Interfaz extendida para activos con información organizacional
export interface AssetWithOrganization extends Omit<Asset, 'department'> {
  plant?: Plant;
  department_info?: Department;
  equipment_models?: EquipmentModel;
  operators?: AssetOperator[];
  primary_operator?: AssetOperator;
  secondary_operators?: AssetOperator[];
}

// Tipos para historiales de mantenimiento
export type MaintenanceHistory = DbTables['maintenance_history']['Row'];
export type InsertMaintenanceHistory = DbTables['maintenance_history']['Insert'];
export type UpdateMaintenanceHistory = DbTables['maintenance_history']['Update'];

// Tipos para historiales de incidentes
export type IncidentHistory = DbTables['incident_history']['Row'];
export type InsertIncidentHistory = DbTables['incident_history']['Insert'];
export type UpdateIncidentHistory = DbTables['incident_history']['Update'];

// Tipos para planes de mantenimiento
export type MaintenancePlan = DbTables['maintenance_plans']['Row'];
export type InsertMaintenancePlan = DbTables['maintenance_plans']['Insert'];
export type UpdateMaintenancePlan = DbTables['maintenance_plans']['Update'];

// Tipos para checklists
export type Checklist = DbTables['checklists']['Row'];
export type InsertChecklist = DbTables['checklists']['Insert'];
export type UpdateChecklist = DbTables['checklists']['Update'];

// Tipos para secciones de checklist
export type ChecklistSection = DbTables['checklist_sections']['Row'];
export type InsertChecklistSection = DbTables['checklist_sections']['Insert'];
export type UpdateChecklistSection = DbTables['checklist_sections']['Update'];

// Tipos para items de checklist
export type ChecklistItem = DbTables['checklist_items']['Row'];
export type InsertChecklistItem = DbTables['checklist_items']['Insert'];
export type UpdateChecklistItem = DbTables['checklist_items']['Update'];

// Tipos para checklists completados
export type CompletedChecklist = DbTables['completed_checklists']['Row'];
export type InsertCompletedChecklist = DbTables['completed_checklists']['Insert'];
export type UpdateCompletedChecklist = DbTables['completed_checklists']['Update'];

// Tipos para problemas detectados en checklists
export type ChecklistIssue = DbTables['checklist_issues']['Row'];
export type InsertChecklistIssue = DbTables['checklist_issues']['Insert'];
export type UpdateChecklistIssue = DbTables['checklist_issues']['Update'];

// Security Talk Section Types
export interface SecurityConfig {
  mode: 'plant_manager' | 'operator';
  require_attendance: boolean;
  require_topic: boolean;
  require_reflection: boolean;
  allow_evidence: boolean;
}

export interface SecurityTalkData {
  attendees?: string[];  // Operator IDs (for plant manager mode)
  attendance?: boolean;   // Single attendance (for operator mode)
  topic?: string;
  reflection?: string;
  evidence?: Array<{
    photo_url: string;
    category?: string;
    description?: string;
  }>;
}

export interface SecurityTalkSectionData {
  [sectionId: string]: SecurityTalkData;
}

// Tipos para órdenes de trabajo
export type WorkOrder = DbTables['work_orders']['Row'];
export type InsertWorkOrder = DbTables['work_orders']['Insert'];
export type UpdateWorkOrder = DbTables['work_orders']['Update'];

// Tipos para órdenes de compra
export type PurchaseOrder = DbTables['purchase_orders']['Row'] & {
  po_purpose?: 'work_order_cash' | 'work_order_inventory' | 'inventory_restock' | 'mixed';
};
export type InsertPurchaseOrder = DbTables['purchase_orders']['Insert'];
export type UpdatePurchaseOrder = DbTables['purchase_orders']['Update'];

// Tipos para órdenes de servicio
export type ServiceOrder = DbTables['service_orders']['Row'];
export type InsertServiceOrder = DbTables['service_orders']['Insert'];
export type UpdateServiceOrder = DbTables['service_orders']['Update'];

// Tipo para completar órdenes de trabajo
export interface WorkOrderCompletion {
  id?: string;
  work_order_id: string;
  completion_date: string;
  completion_time: string;
  downtime_hours: number;
  technician_notes?: string;
  resolution_details: string;
  parts_used?: any[];
  labor_hours: number;
  labor_cost: number;
  total_cost: number;
  created_at?: string;
}

// Tipos para perfiles de usuario (Enhanced for Phase 2)
export type Profile = DbTables['profiles']['Row'] & {
  plant?: Plant;
  business_unit?: BusinessUnit;
  assigned_assets?: AssetOperator[];
  office?: Office;
};
export type InsertProfile = DbTables['profiles']['Insert'];
export type UpdateProfile = DbTables['profiles']['Update'];

// Tipos para oficinas
export type Office = DbTables['offices']['Row'];
export type InsertOffice = DbTables['offices']['Insert'];
export type UpdateOffice = DbTables['offices']['Update'];

// Tipos comunes
export enum AssetStatus {
  Operational = 'operational',
  Maintenance = 'maintenance',
  Repair = 'repair',
  Inactive = 'inactive',
  Retired = 'retired'
}

export enum MaintenanceUnit {
  Hours = 'hours',
  Kilometers = 'kilometers'
}

export enum MaintenanceType {
  Preventive = 'preventive',
  Corrective = 'corrective'
}

export enum ServiceOrderPriority {
  Low = 'Baja',
  Medium = 'Media',
  High = 'Alta',
  Critical = 'Crítica'
}

export enum ServiceOrderStatus {
  Pending = 'Pendiente',
  InProgress = 'En Proceso',
  Completed = 'Completado',
  Cancelled = 'Cancelado'
}

export enum WorkOrderStatus {
  Pending = 'Pendiente',
  Quoted = 'Cotizada',
  Approved = 'Aprobada',
  InProgress = 'En ejecución',
  Completed = 'Completada'
}

export enum PurchaseOrderStatus {
  PendingApproval = 'pending_approval',
  Approved = 'approved',
  Rejected = 'rejected',
  Received = 'received',
  Validated = 'validated'
}

export enum ChecklistIssueStatus {
  Flag = 'flag',
  Fail = 'fail'
}

// Enhanced User Roles for Phase 2 Multi-Plant Organization
export enum UserRole {
  // Legacy roles (for backward compatibility)
  User = 'user',
  MaintenanceManager = 'ENCARGADO_MANTENIMIENTO',
  PlantManager = 'JEFE_PLANTA',
  Executive = 'EJECUTIVO',
  
  // New Phase 2 organizational roles
  GeneralManagement = 'GERENCIA_GENERAL',
  BusinessUnitManager = 'JEFE_UNIDAD_NEGOCIO',
  MaintenanceSpecialist = 'ENCARGADO_MANTENIMIENTO',
  PlantManager2 = 'JEFE_PLANTA',
  Dosificador = 'DOSIFICADOR',
  Operator = 'OPERADOR',
  PurchasingAssistant = 'AUXILIAR_COMPRAS',
  AdministrativeArea = 'AREA_ADMINISTRATIVA',
  Viewer = 'VISUALIZADOR'
}

// Assignment types for asset operators
export enum AssignmentType {
  Primary = 'primary',
  Secondary = 'secondary'
}

// Employee status
export enum EmployeeStatus {
  Active = 'active',
  Inactive = 'inactive',
  Suspended = 'suspended'
}

// Shift types
export enum ShiftType {
  Morning = 'morning',
  Afternoon = 'afternoon',
  Night = 'night'
}

// Interfaz extendida para activos con modelo incluido
export interface AssetWithModel extends Asset {
  model?: EquipmentModel;
}

// Interfaz extendida para historiales con activo incluido
export interface MaintenanceHistoryWithAsset extends MaintenanceHistory {
  asset?: Asset;
  related_work_order?: WorkOrder;
  related_service_order?: ServiceOrder;
}

// Interfaz extendida para órdenes de servicio con activo incluido
export interface ServiceOrderWithAsset extends ServiceOrder {
  asset?: Asset;
  work_order?: WorkOrder;
}

// Interfaz extendida para órdenes de trabajo con activo incluido
export interface WorkOrderWithAsset extends WorkOrder {
  asset?: Asset;
}

// Interfaz extendida para órdenes de trabajo con orden de compra incluida
export interface WorkOrderWithPurchaseOrder extends WorkOrder {
  purchase_order?: PurchaseOrder;
}

// Interfaz extendida para órdenes de trabajo completas
export interface WorkOrderComplete extends WorkOrder {
  asset?: Asset;
  purchase_order?: PurchaseOrder;
  service_order?: ServiceOrder;
  issues?: ChecklistIssue[];
  completion_date?: string;
  completion_time?: string;
  downtime_hours?: number;
  technician_notes?: string;
  resolution_details?: string;
  parts_used?: any[];
  labor_hours?: number;
  labor_cost?: number;
  total_cost?: number;
}

// Interfaz extendida para checklist con secciones e items
export interface ChecklistWithSections extends Checklist {
  sections?: (ChecklistSection & {
    items?: ChecklistItem[];
  })[];
}

// Interfaz para documentación y archivos
export interface FileUpload {
  name: string;
  type: string;
  size: number;
  file: File;
  url?: string;
}

// Interfaz para especificaciones técnicas de modelos
export interface ModelSpecifications {
  general?: {
    weight?: string;
    dimensions?: string;
    power?: string;
    [key: string]: string | undefined;
  };
  dimensions?: {
    length?: string;
    width?: string;
    height?: string;
    [key: string]: string | undefined;
  };
  performance?: {
    maxSpeed?: string;
    fuelConsumption?: string;
    capacity?: string;
    [key: string]: string | undefined;
  };
  [key: string]: Record<string, string | undefined> | undefined;
}

// Interfaz para repuestos utilizados en mantenimientos
export interface MaintenancePart {
  name: string;
  partNumber?: string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
}

// Interfaz para items de órdenes de compra
export interface PurchaseOrderItem {
  id?: string;
  name: string;
  partNumber?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier?: string;
  estimated_delivery?: string;
}

// Interfaz extendida para modelos con sus intervalos de mantenimiento
export interface EquipmentModelWithIntervals extends EquipmentModel {
  maintenanceIntervals?: {
    hours: number;
    type: string;
    id: string;
    name: string;
    description: string;
    tasks?: {
      id: string;
      description: string;
      type: string;
      estimatedTime: number;
      requiresSpecialist: boolean;
      parts: {
        id: string;
        name: string;
        partNumber: string;
        quantity: number;
        cost?: number;
      }[];
    }[];
  }[];
}

// Purchase Order Receipt
export interface PurchaseOrderReceipt {
  id: string;
  purchase_order_id: string;
  file_url: string;
  expense_type: 'materials' | 'labor'; 
  description?: string;
  is_adjustment_receipt: boolean;
  receipt_date?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at?: string;
}

// Receipt expense types 
export enum ExpenseType {
  Materials = 'materials',
  Labor = 'labor'
}

// Phase 2 Organizational Interfaces

// User organizational context
export interface UserOrganizationalContext {
  profile_id: string;
  user_name: string;
  user_role: UserRole;
  plant_id?: string;
  plant_name?: string;
  business_unit_id?: string;
  business_unit_name?: string;
  authorization_limit: number;
  can_manage_operators: boolean;
  can_assign_assets: boolean;
  employee_code?: string;
}

// Asset assignment request
export interface AssetAssignmentRequest {
  asset_id: string;
  operator_id: string;
  assignment_type: AssignmentType;
  start_date?: string;
  end_date?: string;
  notes?: string;
}

// Asset assignment response
export interface AssetAssignmentResponse {
  success: boolean;
  assignment_id?: string;
  error?: string;
  message?: string;
}

// Operator with organizational info
export interface OperatorWithOrganization extends Profile {
  plant?: Plant;
  business_unit?: BusinessUnit;
  current_assignments?: AssetOperator[];
  assignment_count?: number;
}

// Plant with personnel summary
export interface PlantWithPersonnel extends Plant {
  total_operators?: number;
  active_operators?: number;
  total_assets?: number;
  assigned_assets?: number;
  personnel?: Profile[];
}

// Emergency contact structure
export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

// Authorization matrix entry
export interface AuthorizationMatrix {
  role: UserRole;
  max_amount: number;
  requires_approval: boolean;
  approver_role?: UserRole;
  description: string;
} 