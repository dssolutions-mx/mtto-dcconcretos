// Diesel Inventory Types
export interface DieselExcelRow {
  creado: string;
  planta: string;
  clave_producto: string;
  almacen: string;
  tipo: 'Entrada' | 'Salida';
  unidad: string;
  identificador: string;
  fecha_: string;
  horario: string;
  horometro: number | null;
  kilometraje: number | null;
  litros_cantidad: number;
  cuenta_litros: number | null;
  responsable_unidad: string;
  responsable_suministro: string;
  validacion: string;
  inventario_inicial: number | null;
  inventario: number | null;
  original_row_index: number;
  validation_status: 'valid' | 'warning' | 'error';
  validation_messages: string[];
  asset_id: string | null;
  exception_asset_name: string | null;
  asset_category: 'formal' | 'exception' | 'general' | null;
  resolved_asset_name: string | null;
  resolved_asset_type: 'formal' | 'exception' | 'general' | 'unmapped' | null;
  resolved_asset_id: string | null;
  processing_status: 'pending' | 'staged' | 'processed' | 'error' | 'skipped';
  processing_notes: string | null;
}

export interface ImportBatch {
  batch_id: string;
  original_filename: string;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  error_rows: number;
  status: 'uploading' | 'parsing' | 'mapping' | 'staging' | 'processing' | 'completed' | 'error';
  progress_percentage: number;
  created_at: string;
  completed_at: string | null;
  created_by: string;
  processing_summary: {
    total_processed: number;
    successful: number;
    errors: number;
    warnings: number;
    unmapped_assets: number;
    mapped_assets: number;
  } | null;
}

export interface AssetMappingEntry {
  original_name: string;
  suggested_formal_asset_id: string | null;
  suggested_formal_asset_name: string | null;
  suggested_exception_asset_id: string | null;
  suggested_exception_asset_name: string | null;
  confidence_level: number;
  status: 'unmapped' | 'mapped_formal' | 'mapped_exception' | 'ignored';
  selected_mapping_type: 'formal' | 'exception' | 'general' | 'ignore' | null;
  selected_asset_id: string | null;
  selected_exception_asset_name: string | null;
  manual_override: boolean;
  occurrences: number;
  first_seen: string;
  last_seen: string;
}

export interface AssetResolution {
  original_name: string;
  resolution_type: 'formal' | 'exception' | 'general' | 'unmapped';
  asset_id: string | null;
  exception_asset_id: string | null;
  asset_name: string | null;
  exception_asset_name: string | null;
  confidence: number;
  created_new: boolean;
  mapping_notes: string | null;
}

export interface ProcessingError {
  id: string;
  batch_id: string;
  row_number: number;
  error_type: 'validation' | 'mapping' | 'database' | 'processing';
  error_message: string;
  field_name: string | null;
  suggested_fix: string | null;
  severity: 'warning' | 'error' | 'critical';
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface ProcessingNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  dismissed: boolean;
  action?: {
    label: string;
    callback: () => void;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value: any;
    rowNumber: number;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    value: any;
    rowNumber: number;
    suggestion?: string;
  }>;
}
