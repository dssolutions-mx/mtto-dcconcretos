import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { 
  Asset, 
  InsertAsset, 
  EquipmentModel, 
  InsertEquipmentModel,
  MaintenanceHistory,
  InsertMaintenanceHistory,
  ServiceOrder,
  InsertServiceOrder,
  FileUpload,
  MaintenancePart
} from '../types';
import { Json } from './database.types';

// Inicializar cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// API de Modelos de Equipos
export const modelsApi = {
  // Obtener todos los modelos
  getAll: async (): Promise<EquipmentModel[]> => {
    const { data, error } = await supabase
      .from('equipment_models')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  },

  // Obtener un modelo por ID
  getById: async (id: string): Promise<EquipmentModel | null> => {
    const { data, error } = await supabase
      .from('equipment_models')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Crear un nuevo modelo
  create: async (model: InsertEquipmentModel): Promise<EquipmentModel> => {
    const { data, error } = await supabase
      .from('equipment_models')
      .insert([model])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Actualizar un modelo existente
  update: async (id: string, updates: Partial<EquipmentModel>): Promise<EquipmentModel> => {
    const { data, error } = await supabase
      .from('equipment_models')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Subir documentación para un modelo
  uploadDocument: async (modelId: string, file: FileUpload): Promise<string> => {
    const fileName = `${modelId}/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('model-documentation')
      .upload(fileName, file.file);
    
    if (uploadError) throw uploadError;
    
    const { data: urlData } = supabase.storage
      .from('model-documentation')
      .getPublicUrl(fileName);
    
    const documentUrl = urlData.publicUrl;
    
    // Registrar documento en la tabla model_documentation
    await supabase.from('model_documentation').insert({
      model_id: modelId,
      name: file.name,
      type: file.type,
      file_url: documentUrl,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
    });
    
    return documentUrl;
  },

  // Crear un intervalo de mantenimiento para un modelo
  createMaintenanceInterval: async (intervalData: {
    model_id: string;
    interval_value: number;
    name: string;
    description: string | null;
    type: string;
    estimated_duration: number | null;
  }): Promise<any> => {
    const { data, error } = await supabase
      .from('maintenance_intervals')
      .insert([intervalData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Crear una tarea de mantenimiento para un intervalo
  createMaintenanceTask: async (taskData: {
    interval_id: string;
    description: string;
    type: string;
    estimated_time: number;
    requires_specialist: boolean;
  }): Promise<any> => {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .insert([taskData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Crear una parte para una tarea de mantenimiento
  createTaskPart: async (partData: {
    task_id: string;
    name: string;
    part_number: string;
    quantity: number;
    cost?: string | null;
  }): Promise<any> => {
    const { data, error } = await supabase
      .from('task_parts')
      .insert([partData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// API de Activos
export const assetsApi = {
  // Obtener todos los activos
  getAll: async (): Promise<Asset[]> => {
    const { data, error } = await supabase
      .from('assets')
      .select('*, equipment_models(*)')
      .order('name');
    
    if (error) throw error;
    return data || [];
  },

  // Obtener un activo por ID
  getById: async (id: string): Promise<Asset | null> => {
    const { data, error } = await supabase
      .from('assets')
      .select('*, equipment_models(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Crear un nuevo activo
  create: async (asset: InsertAsset): Promise<Asset> => {
    const { data, error } = await supabase
      .from('assets')
      .insert([asset])
      .select('*, equipment_models(*)')
      .single();
    
    if (error) throw error;
    return data;
  },

  // Actualizar un activo existente
  update: async (id: string, updates: Partial<Asset>): Promise<Asset> => {
    const { data, error } = await supabase
      .from('assets')
      .update(updates)
      .eq('id', id)
      .select('*, equipment_models(*)')
      .single();
    
    if (error) throw error;
    return data;
  },

  // Subir fotos para un activo
  uploadPhoto: async (assetId: string, file: FileUpload): Promise<string> => {
    const fileName = `${assetId}/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('asset-photos')
      .upload(fileName, file.file);
    
    if (uploadError) throw uploadError;
    
    const { data: urlData } = supabase.storage
      .from('asset-photos')
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  },

  // Obtener historial de mantenimiento de un activo
  getMaintenanceHistory: async (assetId: string): Promise<MaintenanceHistory[]> => {
    const { data, error } = await supabase
      .from('maintenance_history')
      .select('*')
      .eq('asset_id', assetId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Obtener planes de mantenimiento de un activo
  getMaintenancePlans: async (assetId: string) => {
    const { data, error } = await supabase
      .from('maintenance_plans')
      .select('*, maintenance_intervals(*)')
      .eq('asset_id', assetId)
      .order('next_due');
    
    if (error) throw error;
    return data || [];
  }
};

// API de Mantenimiento
export const maintenanceApi = {
  // Registrar un nuevo mantenimiento
  registerMaintenance: async (maintenance: InsertMaintenanceHistory): Promise<MaintenanceHistory> => {
    const { data, error } = await supabase
      .from('maintenance_history')
      .insert([maintenance])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Completar un mantenimiento
  completeMaintenance: async (
    maintenanceId: string, 
    completion: {
      technician: string;
      date: string;
      findings: string;
      actions: string;
      parts: Json;
      laborHours: number;
      laborCost: string;
      totalCost: string;
      measurementValue: number; // Horas o kilómetros
      documents?: string[];
    }
  ): Promise<MaintenanceHistory> => {
    // Primero actualizamos el registro de mantenimiento
    const { data: maintenanceData, error: maintenanceError } = await supabase
      .from('maintenance_history')
      .update({
        technician: completion.technician,
        date: completion.date,
        findings: completion.findings,
        actions: completion.actions,
        parts: completion.parts,
        labor_hours: completion.laborHours,
        labor_cost: completion.laborCost,
        total_cost: completion.totalCost,
        documents: completion.documents
      })
      .eq('id', maintenanceId)
      .select('*, assets(*)')
      .single();
    
    if (maintenanceError) throw maintenanceError;
    
    // Obtenemos el activo asociado
    const assetId = maintenanceData.asset_id;
    if (!assetId) throw new Error('El mantenimiento no tiene un activo asociado');
    
    // Actualizamos el activo
    const { data: assetData, error: assetError } = await supabase
      .from('assets')
      .select('*, equipment_models(*)')
      .eq('id', assetId)
      .single();
    
    if (assetError) throw assetError;
    
    // Determinamos si usamos horas o kilómetros
    const maintenanceUnit = assetData.equipment_models?.maintenance_unit || 'hours';
    const updates = {
      last_maintenance_date: completion.date,
      status: 'operational'
    };
    
    if (maintenanceUnit === 'hours') {
      Object.assign(updates, { current_hours: completion.measurementValue });
    } else {
      Object.assign(updates, { current_kilometers: completion.measurementValue });
    }
    
    // Actualizamos el activo
    const { error: updateError } = await supabase
      .from('assets')
      .update(updates)
      .eq('id', assetId);
    
    if (updateError) throw updateError;
    
    // Creamos una orden de servicio relacionada
    const { error: orderError } = await supabase
      .from('service_orders')
      .insert({
        asset_id: assetId,
        asset_name: assetData.name,
        type: maintenanceData.type,
        status: 'Completado',
        date: completion.date,
        technician: completion.technician,
        description: maintenanceData.description,
        parts: completion.parts,
        total_cost: completion.totalCost,
        documents: completion.documents
      });
    
    if (orderError) throw orderError;
    
    return maintenanceData;
  }
};

// API de Órdenes de Servicio
export const serviceOrdersApi = {
  // Obtener todas las órdenes de servicio
  getAll: async (): Promise<ServiceOrder[]> => {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*, assets(*)')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Obtener una orden de servicio por ID
  getById: async (id: string): Promise<ServiceOrder | null> => {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*, assets(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Crear una nueva orden de servicio
  create: async (serviceOrder: InsertServiceOrder): Promise<ServiceOrder> => {
    const { data, error } = await supabase
      .from('service_orders')
      .insert([serviceOrder])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Actualizar una orden de servicio existente
  update: async (id: string, updates: Partial<ServiceOrder>): Promise<ServiceOrder> => {
    const { data, error } = await supabase
      .from('service_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Subir documentos para una orden de servicio
  uploadDocument: async (orderId: string, file: FileUpload): Promise<string> => {
    const fileName = `${orderId}/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('maintenance-documents')
      .upload(fileName, file.file);
    
    if (uploadError) throw uploadError;
    
    const { data: urlData } = supabase.storage
      .from('maintenance-documents')
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  }
};

// API para estadísticas y reportes
export const reportsApi = {
  // Estadísticas de mantenimiento
  getMaintenanceStats: async () => {
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('status');
    
    if (assetsError) throw assetsError;
    
    // Calcular activos por estado manualmente
    const statusCounts: Record<string, number> = {};
    assets?.forEach(asset => {
      const status = asset.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    // Total de mantenimientos por tipo
    const { data: maintenances, error: maintenanceError } = await supabase
      .from('maintenance_history')
      .select('type');
    
    if (maintenanceError) throw maintenanceError;
    
    // Calcular mantenimientos por tipo manualmente
    const typeCounts: Record<string, number> = {};
    maintenances?.forEach(maint => {
      typeCounts[maint.type] = (typeCounts[maint.type] || 0) + 1;
    });
    
    // Costos totales de mantenimiento
    const { data: costs, error: costError } = await supabase
      .from('maintenance_history')
      .select('total_cost');
    
    if (costError) throw costError;
    
    // Calcular costo total manualmente
    let totalCost = 0;
    costs?.forEach(cost => {
      if (cost.total_cost) {
        totalCost += parseFloat(cost.total_cost);
      }
    });
    
    return {
      totalAssets: assets?.length || 0,
      statusCounts,
      typeCounts,
      totalCost
    };
  },

  // Próximos mantenimientos
  getUpcomingMaintenance: async () => {
    const { data, error } = await supabase
      .from('maintenance_plans')
      .select('*, assets(*)')
      .gte('next_due', new Date().toISOString())
      .order('next_due')
      .limit(10);
    
    if (error) throw error;
    return data || [];
  }
}; 