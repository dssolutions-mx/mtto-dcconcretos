/**
 * Diesel Excel Parser - Complete Implementation
 * Handles parsing of "Control de Diesel" Excel files for Supabase import
 */

import * as XLSX from 'xlsx';
import { supabase } from './supabase-client'; // Your Supabase client

class DieselExcelParser {
  constructor() {
    this.requiredHeaders = [
      'Creado', 'Planta', 'CLAVE DE PRODUCTO', 'Almacen', 'Tipo',
      'Unidad', 'Identificador', 'Fecha_', 'Horario', 'Horómetro',
      'Kilometraje', 'Litros (Cantidad)', 'Cuenta litros',
      'Responsable de unidad', 'Responsable de suministro',
      'Validación', 'INVENTARIO INICIAL', 'Inventario'
    ];
    
    this.columnMapping = {
      'Creado': 'creado',
      'Planta': 'planta', 
      'CLAVE DE PRODUCTO': 'clave_producto',
      'Almacen': 'almacen',
      'Tipo': 'tipo',
      'Unidad': 'unidad',
      'Identificador': 'identificador',
      'Fecha_': 'fecha_',
      'Horario': 'horario',
      'Horómetro': 'horometro',
      'Kilometraje': 'kilometraje',
      'Litros (Cantidad)': 'litros_cantidad',
      'Cuenta litros': 'cuenta_litros',
      'Responsable de unidad': 'responsable_unidad',
      'Responsable de suministro': 'responsable_suministro',
      'Validación': 'validacion',
      'INVENTARIO INICIAL': 'inventario_inicial',
      'Inventario': 'inventario'
    };

    this.validationErrors = [];
    this.importSummary = {
      totalRows: 0,
      processedRows: 0,
      errorRows: 0,
      skippedRows: 0
    };
  }

  /**
   * Main parsing method
   */
  async parseFile(file) {
    try {
      console.log('🚀 Starting diesel Excel parsing...');
      
      // Step 1: Read and validate Excel file
      const workbook = await this.readExcelFile(file);
      const rawData = this.extractSheetData(workbook);
      
      // Step 2: Validate file structure
      this.validateFileStructure(rawData);
      
      // Step 3: Clean and transform data
      const cleanedData = this.cleanAndTransformData(rawData);
      
      // Step 4: Generate import batch ID
      const batchId = this.generateBatchId();
      
      // Step 5: Stage data in database
      const stagingResult = await this.stageDataInDatabase(cleanedData, batchId);
      
      // Step 6: Resolve reference data
      await this.resolveReferenceData(batchId);
      
      // Step 7: Validate business rules
      await this.validateBusinessRules(batchId);
      
      // Step 8: Import to final table
      const importResult = await this.importToFinalTable(batchId);
      
      // Step 9: Generate report
      const report = this.generateImportReport(batchId, importResult);
      
      console.log('✅ Diesel Excel parsing completed successfully');
      return {
        success: true,
        batchId,
        summary: this.importSummary,
        report,
        errors: this.validationErrors
      };
      
    } catch (error) {
      console.error('❌ Error during Excel parsing:', error);
      return {
        success: false,
        error: error.message,
        summary: this.importSummary,
        errors: this.validationErrors
      };
    }
  }

  /**
   * Read Excel file using SheetJS
   */
  async readExcelFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    return XLSX.read(arrayBuffer, {
      cellStyles: true,
      cellFormulas: true,
      cellDates: true,
      cellNF: true,
      sheetStubs: true
    });
  }

  /**
   * Extract data from the main sheet
   */
  extractSheetData(workbook) {
    const sheetName = 'Control de Diesel';
    
    if (!workbook.Sheets[sheetName]) {
      throw new Error(`Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
    }

    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    console.log(`📊 Found ${range.e.r + 1} rows and ${range.e.c + 1} columns`);
    this.importSummary.totalRows = range.e.r; // Excluding header

    // Convert to JSON with header row
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: null,
      blankrows: false
    });

    return jsonData;
  }

  /**
   * Validate file structure and headers
   */
  validateFileStructure(data) {
    if (!data || data.length < 2) {
      throw new Error('File appears to be empty or has no data rows');
    }

    const headers = data[0];
    const missingHeaders = this.requiredHeaders.filter(
      required => !headers.includes(required)
    );

    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    console.log('✅ File structure validation passed');
  }

  /**
   * Clean and transform raw Excel data
   */
  cleanAndTransformData(rawData) {
    const headers = rawData[0];
    const dataRows = rawData.slice(1);
    
    const cleanedData = dataRows.map((row, index) => {
      const rowData = {};
      
      headers.forEach((header, colIndex) => {
        if (this.columnMapping[header]) {
          const dbColumn = this.columnMapping[header];
          let value = row[colIndex];
          
          // Clean and transform specific data types
          value = this.cleanCellValue(value, header, index + 2);
          rowData[dbColumn] = value;
        }
      });

      // Add metadata
      rowData.original_row_number = index + 2;
      rowData.processed = false;
      
      return rowData;
    }).filter(row => this.isValidDataRow(row));

    this.importSummary.processedRows = cleanedData.length;
    this.importSummary.skippedRows = this.importSummary.totalRows - cleanedData.length;
    
    console.log(`🧹 Cleaned data: ${cleanedData.length} valid rows`);
    return cleanedData;
  }

  /**
   * Clean individual cell values based on data type
   */
  cleanCellValue(value, header, rowNumber) {
    try {
      // Handle null/undefined/empty values
      if (value === null || value === undefined || value === '') {
        return null;
      }

      // Date handling
      if (header === 'Creado' || header === 'Fecha_') {
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (typeof value === 'number') {
          // Excel date serial number
          const date = new Date((value - 25569) * 86400 * 1000);
          return date.toISOString();
        }
        