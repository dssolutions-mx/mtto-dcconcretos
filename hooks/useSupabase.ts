import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Database } from '../lib/database.types';
import { 
  EquipmentModel, 
  Asset,
  MaintenanceHistory,
  ServiceOrder,
  MaintenanceInterval,
  ModelDocumentation
} from '../types';

// Ya no necesitamos crear un cliente aquí, usamos el importado
export const supabase = createClient();

// Hook para obtener y actualizar modelos
export function useEquipmentModels() {
  const [models, setModels] = useState<EquipmentModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('equipment_models')
        .select('*')
        .order('name');

      if (error) throw error;
      setModels(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  return { models, loading, error, refetch: fetchModels };
}

// Hook para obtener un modelo de equipo específico con todos sus datos relacionados
export function useEquipmentModel(id: string) {
  const [model, setModel] = useState<EquipmentModel | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [maintenanceIntervals, setMaintenanceIntervals] = useState<MaintenanceInterval[]>([]);
  const [documentation, setDocumentation] = useState<ModelDocumentation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchModelDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener detalles básicos del modelo
      const { data: modelData, error: modelError } = await supabase
        .from('equipment_models')
        .select('*')
        .eq('id', id)
        .single();

      if (modelError) throw modelError;
      setModel(modelData);

      // Obtener activos asociados a este modelo
      const { data: assetsData, error: assetsError } = await supabase
        .from('assets')
        .select('*')
        .eq('model_id', id);

      if (assetsError) throw assetsError;
      setAssets(assetsData || []);

      // Obtener intervalos de mantenimiento con tareas y partes
      const { data: intervalsData, error: intervalsError } = await supabase
        .from('maintenance_intervals')
        .select(`
          *,
          maintenance_tasks(
            *,
            task_parts(*)
          )
        `)
        .eq('model_id', id);

      if (intervalsError) throw intervalsError;
      setMaintenanceIntervals(intervalsData || []);

      // Obtener documentación técnica
      const { data: docsData, error: docsError } = await supabase
        .from('model_documentation')
        .select('*')
        .eq('model_id', id);

      if (docsError) throw docsError;
      setDocumentation(docsData || []);

    } catch (err) {
      console.error("Error al cargar datos del modelo:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchModelDetails();
    }
  }, [id]);

  return { 
    model, 
    assets, 
    maintenanceIntervals, 
    documentation, 
    loading, 
    error, 
    refetch: fetchModelDetails 
  };
}

// Hook para obtener y actualizar activos
export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          plants (
            id,
            name,
            code,
            business_units (
              id,
              name,
              code
            )
          ),
          departments (
            id,
            name,
            code
          ),
          equipment_models(*)
        `)
        .order('name');

      if (error) throw error;
      setAssets(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  return { assets, loading, error, refetch: fetchAssets };
}

// Hook para obtener un activo específico por ID
export function useAsset(assetId: string | null) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAsset = async () => {
    if (!assetId) {
      setAsset(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          plants (
            id,
            name,
            code,
            business_units (
              id,
              name,
              code
            )
          ),
          departments (
            id,
            name,
            code
          ),
          equipment_models(*)
        `)
        .eq('id', assetId)
        .single();

      if (error) throw error;
      setAsset(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAsset();
  }, [assetId]);

  return { asset, loading, error, refetch: fetchAsset };
}

// Hook para obtener el historial de mantenimiento de un activo
export function useMaintenanceHistory(assetId: string | null) {
  const [history, setHistory] = useState<MaintenanceHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = async () => {
    if (!assetId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('maintenance_history')
        .select('*')
        .eq('asset_id', assetId)
        .order('date', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [assetId]);

  return { history, loading, error, refetch: fetchHistory };
}

// Hook para obtener el historial de incidentes de un activo
export function useIncidents(assetId: string | null) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIncidents = async () => {
    if (!assetId) {
      setIncidents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Mejorado para incluir información de órdenes de trabajo y órdenes de compra
      const { data, error } = await supabase
        .from('incident_history')
        .select(`
          *,
          work_order:work_order_id (
            id,
            order_id,
            status,
            purchase_order_id
          )
        `)
        .eq('asset_id', assetId)
        .order('date', { ascending: false });

      if (error) throw error;
      
      // Procesar los datos para añadir purchase_order_id directamente al incidente
      const processedData = (data || []).map((incident: any) => {
        const result = { ...incident };
        
        // Si el incidente tiene una orden de trabajo con orden de compra, añadirla directamente
        if (incident.work_order && incident.work_order.purchase_order_id) {
          result.purchase_order_id = incident.work_order.purchase_order_id;
        }
        
        return result;
      });
      
      setIncidents(processedData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [assetId]);

  return { incidents, loading, error, refetch: fetchIncidents };
}

// Hook para obtener órdenes de servicio
export function useServiceOrders() {
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchServiceOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_orders')
        .select('*, assets(*)')
        .order('date', { ascending: false });

      if (error) throw error;
      setServiceOrders(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceOrders();
  }, []);

  return { serviceOrders, loading, error, refetch: fetchServiceOrders };
}

// Hook para obtener una orden de servicio específica por ID
export function useServiceOrder(orderId: string | null) {
  const [serviceOrder, setServiceOrder] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchServiceOrder = async () => {
    if (!orderId) {
      setServiceOrder(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('service_orders')
        .select('*, assets(*)')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setServiceOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceOrder();
  }, [orderId]);

  return { serviceOrder, loading, error, refetch: fetchServiceOrder };
}

// Hook para obtener planes de mantenimiento próximos
export function useUpcomingMaintenance() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('maintenance_plans')
        .select('*, assets(*), maintenance_intervals(*)')
        .gte('next_due', new Date().toISOString())
        .order('next_due')
        .limit(10);

      if (error) throw error;
      setPlans(data || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  return { plans, loading, error, refetch: fetchPlans };
}

// Hook para autenticación y perfil de usuario
// DEPRECATED: This hook is deprecated, use useAuthZustand from '@/hooks/use-auth-zustand' instead
export function useAuthDeprecated() {
  const [user, setUser] = useState(supabase.auth.getUser);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading, error, refetch: fetchProfile };
} 