"use client"

import { Building2 } from 'lucide-react'

export function PrintSpecifications() {
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border p-6 print:hidden">
      <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
        <div className="bg-blue-100 rounded-full p-2 mr-3">
          <Building2 size={20} className="text-blue-600" />
        </div>
        Especificaciones de Impresión
      </h3>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold text-gray-700 mb-3">Dimensiones y Formato:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <strong>Tamaño:</strong> 250px × 400px (escala a 63mm × 100mm)
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <strong>Orientación:</strong> Vertical (Portrait)
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              <strong>Resolución:</strong> 300 DPI mínimo
            </li>
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold text-gray-700 mb-3">Materiales Recomendados:</h4>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <strong>Papel:</strong> PVC o cartulina 350gsm+
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <strong>Acabado:</strong> Laminado mate o brillante
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              <strong>Esquinas:</strong> Redondeadas 3mm radio
            </li>
          </ul>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Nota importante:</strong> Verificar ajustes de color en la impresora para 
          asegurar que los gradientes azules se reproduzcan correctamente.
        </p>
      </div>
    </div>
  );
}
