"use client"

import { useState, useEffect, useRef } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Fuel, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Camera,
  TrendingDown,
  Save,
  X,
  Wifi,
  WifiOff
} from "lucide-react"
import { AssetSelectorMobile } from "./asset-selector-mobile"
import { ReadingCapture } from "./reading-capture"
import { SmartPhotoUpload } from "@/components/checklists/smart-photo-upload"
import { toast } from "sonner"
import {
  resolveDieselTransactionPlantId,
  validateDieselTransactionScope
} from "@/lib/diesel/submit-scope-validation"
import { getLocalDateString, getLocalTimeString } from "@/lib/diesel/date-utils"
import type { DieselEvidenceImageMetadata } from "@/lib/photos/diesel-evidence-image-metadata"
import { describeDieselSaveError } from "@/lib/diesel/diesel-save-error-message"
import { loadDieselOrganizationalScope } from "@/lib/diesel/load-organizational-scope"
import { initOfflineClient, offlineClient } from "@/lib/offline/offline-client"
import {
  buildConsumptionTransactionData,
  submitDurableDieselConsumption,
} from "@/lib/diesel/durable-diesel-submit"
import {
  type DieselConsumptionDraftData,
  dieselConsumptionDraftHasContent,
  dieselConsumptionDraftIsComplete,
  isDieselConsumptionDraftStale,
} from "@/lib/diesel/diesel-consumption-draft"
import {
  buildConsumptionDraftSnapshot,
  ensureConsumptionWipQueued,
  isConsumptionFormSubmittable,
} from "@/lib/diesel/diesel-consumption-wip"
import { requestSync } from "@/lib/offline/sync-bridge"
import {
  computeCuentaLitrosVariance,
  CUENTA_LITROS_VARIANCE_TOLERANCE_LITERS,
} from "@/lib/diesel/cuenta-litros-variance"
import { DieselOfflineStatus } from "@/components/diesel-inventory/diesel-offline-status"

interface ConsumptionEntryFormProps {
  productType: 'diesel' | 'urea'
  /** When set (e.g. from /diesel/consumo?warehouseId=), preselect warehouse after lists load */
  initialWarehouseId?: string | null
  onSuccess?: (transactionId: string) => void
  onCancel?: () => void
}

export function ConsumptionEntryForm({
  productType,
  initialWarehouseId,
  onSuccess,
  onCancel
}: ConsumptionEntryFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false)
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true)

  // Form state
  const [businessUnits, setBusinessUnits] = useState<any[]>([])
  const [plants, setPlants] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  /** All warehouses in BU — used when Jefe de Unidad filters by plant or picks warehouse without plant step */
  const [allBuWarehouses, setAllBuWarehouses] = useState<any[]>([])
  const [accessProfile, setAccessProfile] = useState<{
    business_unit_id: string | null
    plant_id: string | null
  } | null>(null)
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState<string | null>(null)
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null)

  const dieselBuWideMode = !!(
    accessProfile?.business_unit_id &&
    !accessProfile.plant_id &&
    selectedBusinessUnit === accessProfile.business_unit_id
  )
  const [productId, setProductId] = useState<string | null>(null)
  const [assetType, setAssetType] = useState<'formal' | 'exception'>('formal')
  const [selectedAsset, setSelectedAsset] = useState<any>(null)
  const [exceptionAssetName, setExceptionAssetName] = useState<string>("")
  const [quantityLiters, setQuantityLiters] = useState<string>("")
  const [transactionDate, setTransactionDate] = useState<string>(() => getLocalDateString())
  const [transactionTime, setTransactionTime] = useState<string>(() => getLocalTimeString())
  const [cuentaLitros, setCuentaLitros] = useState<string>("")
  const [previousCuentaLitros, setPreviousCuentaLitros] = useState<number | null>(null)
  const [readings, setReadings] = useState<any>({})
  const [notes, setNotes] = useState("")
  
  // Evidence photos
  const [machinePhoto, setMachinePhoto] = useState<string | null>(null)
  const [machinePhotoDraftId, setMachinePhotoDraftId] = useState<string | null>(null)
  const [wipOutboxId, setWipOutboxId] = useState<string | null>(null)
  const [draftRecovered, setDraftRecovered] = useState(false)
  const [recoveredWasComplete, setRecoveredWasComplete] = useState(false)
  const autoSyncOnRecoverRef = useRef(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [pendingDieselSync, setPendingDieselSync] = useState(0)
  const draftRestoredRef = useRef(false)
  const previewObjectUrlRef = useRef<string | null>(null)
  const formSnapshotRef = useRef<Record<string, unknown>>({})
  const [machineEvidenceMetadata, setMachineEvidenceMetadata] =
    useState<DieselEvidenceImageMetadata | null>(null)

  // Validation state
  const [cuentaLitrosValid, setCuentaLitrosValid] = useState<boolean | null>(null)
  const [cuentaLitrosVariance, setCuentaLitrosVariance] = useState<number | null>(null)
  const [cuentaLitrosManuallyEdited, setCuentaLitrosManuallyEdited] = useState<boolean>(false)
  const [backdatingThresholdMinutes, setBackdatingThresholdMinutes] = useState<number>(120)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    void initOfflineClient()
    void refreshPendingDieselCount()
    void requestSync()
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id)
    })
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current)
      }
    }
  }, [])

  const refreshPendingDieselCount = async () => {
    try {
      const stats = await offlineClient.getDomainSyncStats("diesel")
      setPendingDieselSync(stats.pending + stats.failed)
    } catch {
      /* non-fatal */
    }
  }

  const buildWipContext = () => ({
    productType,
    productId: productId ?? "",
    userId: userId ?? "",
    selectedPlant,
    selectedWarehouse: selectedWarehouse ?? "",
    warehouses,
    allBuWarehouses,
    assetType,
    selectedAsset,
    exceptionAssetName,
    quantityLiters,
    cuentaLitros,
    previousCuentaLitros,
    cuentaLitrosVariance,
    readings,
    transactionDate,
    transactionTime,
    notes,
    machinePhotoDraftId,
    machineEvidenceMetadata,
    wipOutboxId,
  })

  const flushDraftNow = async () => {
    if (!productId) return
    const draft = buildConsumptionDraftSnapshot({
      ...buildWipContext(),
      selectedBusinessUnit,
      cuentaLitrosManuallyEdited,
      wipOutboxId,
    })
    if (!dieselConsumptionDraftHasContent(draft)) return
    try {
      await offlineClient.saveDieselConsumptionDraft(draft)
    } catch (error) {
      console.warn("Could not flush diesel consumption draft:", error)
    }
  }

  const flushWipNow = async () => {
    if (!userId || !productId || !selectedWarehouse || loading) return
    const ctx = buildWipContext()
    if (!isConsumptionFormSubmittable(ctx)) return
    try {
      const id = await ensureConsumptionWipQueued(ctx)
      if (id) {
        setWipOutboxId(id)
        await flushDraftNow()
        void refreshPendingDieselCount()
      }
    } catch (error) {
      console.warn("Could not flush diesel WIP queue:", error)
    }
  }

  useEffect(() => {
    formSnapshotRef.current = {
      productType,
      selectedBusinessUnit,
      selectedPlant,
      selectedWarehouse,
      assetType,
      selectedAsset,
      exceptionAssetName,
      quantityLiters,
      transactionDate,
      transactionTime,
      cuentaLitros,
      cuentaLitrosManuallyEdited,
      readings,
      notes,
      machinePhotoDraftId,
      wipOutboxId,
      userId,
      productId,
    }
  })

  useEffect(() => {
    const onPageHide = () => {
      void flushDraftNow()
      void flushWipNow()
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onPageHide()
    }
    window.addEventListener("pagehide", onPageHide)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("pagehide", onPageHide)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  })

  useEffect(() => {
    if (draftRestoredRef.current) return
    draftRestoredRef.current = true

    void (async () => {
      try {
        const raw = await offlineClient.getDieselConsumptionDraft()
        if (!raw || typeof raw !== "object") return
        const draft = raw as DieselConsumptionDraftData
        if (isDieselConsumptionDraftStale(draft) || !dieselConsumptionDraftHasContent(draft)) {
          await offlineClient.clearDieselConsumptionDraft()
          return
        }

        if (draft.productType === productType) {
          setSelectedBusinessUnit(draft.selectedBusinessUnit)
          setSelectedPlant(draft.selectedPlant)
          setSelectedWarehouse(draft.selectedWarehouse)
          setAssetType(draft.assetType)
          if (draft.selectedAssetId) {
            setSelectedAsset({
              id: draft.selectedAssetId,
              name: draft.selectedAssetName,
            })
          }
          setExceptionAssetName(draft.exceptionAssetName)
          setQuantityLiters(draft.quantityLiters)
          setTransactionDate(draft.transactionDate)
          setTransactionTime(draft.transactionTime)
          setCuentaLitros(draft.cuentaLitros)
          setCuentaLitrosManuallyEdited(draft.cuentaLitrosManuallyEdited)
          setReadings(draft.readings)
          setNotes(draft.notes)
          setMachinePhotoDraftId(draft.machinePhotoDraftId)
          if (draft.wipOutboxId) setWipOutboxId(draft.wipOutboxId)

          const staging = await offlineClient.getDieselConsumptionStagingPhoto()
          if (staging?.blob) {
            if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current)
            const url = URL.createObjectURL(staging.blob)
            previewObjectUrlRef.current = url
            setMachinePhoto(url)
            setMachinePhotoDraftId(staging.id)
          } else if (draft.machinePhotoPreview) {
            setMachinePhoto(draft.machinePhotoPreview)
          }

          setDraftRecovered(true)
          setRecoveredWasComplete(dieselConsumptionDraftIsComplete(draft))
          toast.info("Consumo recuperado en este dispositivo", {
            description: dieselConsumptionDraftIsComplete(draft)
              ? "Los datos estaban completos y se protegieron ante un cierre inesperado."
              : "Continúa donde lo dejaste.",
            duration: 6000,
          })
        }
      } catch (error) {
        console.warn("Could not restore diesel consumption draft:", error)
      }
    })()
  }, [productType])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) void flushDraftNow()
    }, 400)
    return () => clearTimeout(timer)
  }, [
    productType,
    selectedBusinessUnit,
    selectedPlant,
    selectedWarehouse,
    assetType,
    selectedAsset,
    exceptionAssetName,
    quantityLiters,
    transactionDate,
    transactionTime,
    cuentaLitros,
    cuentaLitrosManuallyEdited,
    readings,
    notes,
    machinePhotoDraftId,
    wipOutboxId,
    loading,
    userId,
    productId,
  ])

  useEffect(() => {
    if (!userId || !productId || loading) return
    const timer = setTimeout(() => {
      void flushWipNow()
      if (isOnline) void requestSync()
    }, 350)
    return () => clearTimeout(timer)
  }, [
    userId,
    productId,
    selectedWarehouse,
    selectedPlant,
    assetType,
    selectedAsset,
    exceptionAssetName,
    quantityLiters,
    cuentaLitros,
    previousCuentaLitros,
    readings,
    transactionDate,
    transactionTime,
    notes,
    machinePhotoDraftId,
    machineEvidenceMetadata,
    wipOutboxId,
    isOnline,
    loading,
    warehouses,
    allBuWarehouses,
  ])

  useEffect(() => {
    if (!wipOutboxId || !userId || !productId) return
    void (async () => {
      const entries = await offlineClient.listDieselOutboxEntries()
      if (entries.some((e) => e.id === wipOutboxId)) {
        void requestSync()
        void refreshPendingDieselCount()
        return
      }
      if (selectedWarehouse && isConsumptionFormSubmittable(buildWipContext())) {
        const id = await ensureConsumptionWipQueued(buildWipContext())
        if (id) setWipOutboxId(id)
        void refreshPendingDieselCount()
      }
    })()
  }, [wipOutboxId, userId, productId, selectedWarehouse, machinePhotoDraftId, quantityLiters])

  // If the OS killed the browser after the form was complete, the WIP is already in
  // IndexedDB — push it to the server automatically when the app reopens online.
  useEffect(() => {
    if (
      !recoveredWasComplete ||
      !wipOutboxId ||
      !isOnline ||
      !userId ||
      !productId ||
      autoSyncOnRecoverRef.current
    ) {
      return
    }
    if (!isConsumptionFormSubmittable(buildWipContext())) return

    autoSyncOnRecoverRef.current = true

    void (async () => {
      setLoading(true)
      try {
        const result = await submitDurableDieselConsumption({
          transactionData: {},
          quantityLiters,
          cuentaLitros,
          isOnline: true,
          existingOutboxId: wipOutboxId,
        })

        if (result.status === "synced") {
          toast.success("Consumo recuperado y registrado en el servidor", {
            description: "Se completó automáticamente tras un cierre inesperado de la app.",
            duration: 6000,
          })
          setSelectedAsset(null)
          setExceptionAssetName("")
          setQuantityLiters("")
          setCuentaLitros("")
          setCuentaLitrosManuallyEdited(false)
          setMachinePhoto(null)
          setMachinePhotoDraftId(null)
          setWipOutboxId(null)
          setDraftRecovered(false)
          setRecoveredWasComplete(false)
          if (previewObjectUrlRef.current) {
            URL.revokeObjectURL(previewObjectUrlRef.current)
            previewObjectUrlRef.current = null
          }
          setMachineEvidenceMetadata(null)
          setNotes("")
          setReadings({})
          setPreviousCuentaLitros(null)
          void refreshPendingDieselCount()
          if (onSuccess) onSuccess(result.outboxId)
        } else if (result.status === "queued") {
          toast.warning("Consumo recuperado — sincronización en curso", {
            description: "Los datos están seguros en el dispositivo.",
            duration: 8000,
          })
          void refreshPendingDieselCount()
        }
      } catch (error) {
        console.error("Auto-sync recovered diesel consumption failed:", error)
      } finally {
        setLoading(false)
      }
    })()
  }, [
    recoveredWasComplete,
    wipOutboxId,
    isOnline,
    userId,
    productId,
    quantityLiters,
    cuentaLitros,
    onSuccess,
  ])

  // Load organizational structure and product on mount
  useEffect(() => {
    loadOrganizationalStructure()
    loadProduct()
    loadBackdatingThreshold()
  }, [productType])

  useEffect(() => {
    if (!initialWarehouseId) return
    const combined = [...warehouses, ...allBuWarehouses]
    const seen = new Set<string>()
    const uniq = combined.filter((w) => {
      if (seen.has(w.id)) return false
      seen.add(w.id)
      return true
    })
    const found = uniq.find((w) => w.id === initialWarehouseId)
    if (found) {
      setSelectedWarehouse(found.id)
      if (found.plant_id) setSelectedPlant(found.plant_id)
    }
  }, [initialWarehouseId, warehouses, allBuWarehouses])

  const loadProduct = async () => {
    try {
      // Get the product by product type
      const expectedProductCode = productType === 'diesel' ? '07DS01' : '07UR01'
      const { data, error } = await supabase
        .from('diesel_products')
        .select('id')
        .eq('product_code', expectedProductCode)
        .eq('product_type', productType)
        .single()

      if (error) {
        console.error(`Error loading ${productType} product:`, error)
        // Fallback: get any product of this type
        const { data: fallback } = await supabase
          .from('diesel_products')
          .select('id')
          .eq('product_type', productType)
          .limit(1)
          .single()
        
        if (fallback) {
          setProductId(fallback.id)
        }
      } else if (data) {
        setProductId(data.id)
      }
    } catch (error) {
      console.error(`Error loading ${productType} product:`, error)
    }
  }

  const loadBackdatingThreshold = async () => {
    try {
      const { data, error } = await supabase.rpc('get_diesel_backdating_threshold_minutes')
      if (!error && typeof data === 'number') {
        setBackdatingThresholdMinutes(data)
      }
    } catch (error) {
      console.warn('Using default backdating threshold (120m)')
    }
  }

  const loadOrganizationalStructure = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, plant_id, business_unit_id, role')
        .eq('id', user.id)
        .single()

      if (!profile) return

      const loaded = await loadDieselOrganizationalScope(supabase, profile, productType)

      setAccessProfile(loaded.accessProfile)
      setBusinessUnits(loaded.businessUnits)
      setPlants(loaded.plants)
      setWarehouses(loaded.warehouses)
      setAllBuWarehouses(loaded.allBuWarehouses)
      setSelectedBusinessUnit(loaded.selectedBusinessUnit)
      setSelectedPlant(loaded.selectedPlant)
      if (loaded.selectedWarehouse) {
        setSelectedWarehouse(loaded.selectedWarehouse)
      }
    } catch (error) {
      console.error('Error loading organizational structure:', error)
      toast.error('Error al cargar plantas y almacenes')
    }
  }

  const loadPlantsForBusinessUnit = async (businessUnitId: string) => {
    try {
      const { data } = await supabase
        .from('plants')
        .select('*')
        .eq('business_unit_id', businessUnitId)
        .order('name')

      setPlants(data || [])
    } catch (error) {
      console.error('Error loading plants:', error)
    }
  }

  const loadWarehousesForBusinessUnit = async (businessUnitId: string) => {
    try {
      const { data: plantRows, error: plantErr } = await supabase
        .from('plants')
        .select('id')
        .eq('business_unit_id', businessUnitId)

      if (plantErr) {
        console.error('Error loading plants for BU warehouses:', plantErr)
        toast.error('Error al cargar almacenes')
        return
      }

      const plantIds = (plantRows ?? []).map((p) => p.id).filter(Boolean)
      if (plantIds.length === 0) {
        setWarehouses([])
        setAllBuWarehouses([])
        return
      }

      const { data, error } = await supabase
        .from('diesel_warehouses')
        .select(
          'id, name, warehouse_code, capacity_liters, current_inventory, has_cuenta_litros, plant_id'
        )
        .in('plant_id', plantIds)
        .eq('product_type', productType)
        .order('name')

      if (error) {
        console.error('Error loading BU warehouses:', error)
        toast.error('Error al cargar almacenes')
        return
      }

      const list = data || []
      setAllBuWarehouses(list)
      setWarehouses(list)

      if (list.length === 1) {
        setSelectedWarehouse(list[0].id)
        if (list[0].plant_id) setSelectedPlant(list[0].plant_id)
      }
    } catch (error) {
      console.error('Error loading BU warehouses:', error)
      toast.error('Error al cargar almacenes')
    }
  }

  const loadWarehousesForPlant = async (plantId: string) => {
    try {
      // Load warehouses with current inventory - filter by product_type
      const { data, error } = await supabase
        .from('diesel_warehouses')
        .select('id, name, warehouse_code, capacity_liters, current_inventory, has_cuenta_litros, plant_id')
        .eq('plant_id', plantId)
        .eq('product_type', productType)
        .order('name')

      if (error) {
        console.error('Error loading warehouses:', error)
        toast.error("Error al cargar almacenes")
        return
      }

      setWarehouses(data || [])
      setAllBuWarehouses([])

      // Auto-select if only one warehouse
      if (data && data.length === 1) {
        setSelectedWarehouse(data[0].id)
        if (data[0].plant_id) setSelectedPlant(data[0].plant_id)
      }
    } catch (error) {
      console.error('Error loading warehouses:', error)
      toast.error("Error al cargar almacenes")
    }
  }

  // Handle business unit change
  const handleBusinessUnitChange = (buId: string) => {
    setSelectedBusinessUnit(buId)
    setSelectedPlant(null)
    setSelectedWarehouse(null)
    setPlants([])
    setWarehouses([])
    setAllBuWarehouses([])
    void loadPlantsForBusinessUnit(buId)
  }

  const handleWarehouseChange = (warehouseId: string) => {
    setSelectedWarehouse(warehouseId)
    const wh =
      warehouses.find((w) => w.id === warehouseId) ??
      allBuWarehouses.find((w) => w.id === warehouseId)
    if (wh?.plant_id) setSelectedPlant(wh.plant_id)
  }

  // Handle plant change
  const handlePlantChange = (plantId: string) => {
    const id = plantId || null
    setSelectedPlant(id)
    setSelectedWarehouse(null)

    if (!id) {
      if (dieselBuWideMode && allBuWarehouses.length > 0) {
        setWarehouses(allBuWarehouses)
      } else {
        setWarehouses([])
      }
      return
    }

    if (dieselBuWideMode && allBuWarehouses.length > 0) {
      setWarehouses(allBuWarehouses.filter((w) => w.plant_id === id))
    } else {
      setWarehouses([])
      void loadWarehousesForPlant(id)
    }
  }

  // Load cuenta litros from warehouse (not from last transaction)
  useEffect(() => {
    if (!selectedWarehouse) {
      setPreviousCuentaLitros(null)
      setCuentaLitros("")
      setCuentaLitrosManuallyEdited(false)
      return
    }

    // Reset cuenta litros field when warehouse changes
    setCuentaLitros("")
    setCuentaLitrosManuallyEdited(false)
    loadWarehouseCuentaLitros()
  }, [selectedWarehouse])

  const loadWarehouseCuentaLitros = async () => {
    if (!selectedWarehouse) return

    try {
      // Get current cuenta_litros from warehouse table
      const { data, error } = await supabase
        .from('diesel_warehouses')
        .select('current_cuenta_litros, has_cuenta_litros')
        .eq('id', selectedWarehouse)
        .single()

      if (error) {
        console.error('Error loading warehouse cuenta litros:', error)
        return
      }

      if (data) {
        // If warehouse doesn't have cuenta litros, set to null (no validation)
        if (!data.has_cuenta_litros) {
          setPreviousCuentaLitros(null)
          toast.info("Este almacén no tiene cuenta litros", {
            description: "No se validará el cuenta litros para este almacén"
          })
        } else if (data.current_cuenta_litros !== null) {
          setPreviousCuentaLitros(parseFloat(data.current_cuenta_litros))
        } else {
          // First transaction for this warehouse
          setPreviousCuentaLitros(null)
        }
      }
    } catch (error) {
      console.error('Error loading warehouse cuenta litros:', error)
    }
  }

  // Calculate suggested value (but don't auto-fill - user must click button)
  const getSuggestedCuentaLitros = () => {
    if (quantityLiters && previousCuentaLitros !== null) {
      const quantity = parseFloat(quantityLiters)
      if (!isNaN(quantity)) {
        return (previousCuentaLitros + quantity).toFixed(1)
      }
    }
    return null
  }

  // Validate cuenta litros against quantity
  useEffect(() => {
    if (!quantityLiters || !cuentaLitros || previousCuentaLitros === null) {
      setCuentaLitrosValid(null)
      setCuentaLitrosVariance(null)
      return
    }

    const quantity = parseFloat(quantityLiters)
    const currentCuenta = parseFloat(cuentaLitros)

    if (isNaN(quantity) || isNaN(currentCuenta)) {
      setCuentaLitrosValid(null)
      setCuentaLitrosVariance(null)
      return
    }

    const { variance, withinTolerance } = computeCuentaLitrosVariance(
      previousCuentaLitros,
      currentCuenta,
      quantity,
    )

    setCuentaLitrosVariance(variance)
    setCuentaLitrosValid(withinTolerance)
  }, [quantityLiters, cuentaLitros, previousCuentaLitros])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)

    try {
    console.log('=== FORM SUBMISSION STARTED ===')
    console.log('Asset Type:', assetType)
    console.log('Selected Warehouse:', selectedWarehouse)
    console.log('Selected Asset:', selectedAsset)
    console.log('Exception Asset Name:', exceptionAssetName)
    console.log('Quantity:', quantityLiters)
    console.log('Cuenta Litros:', cuentaLitros)
    console.log('Machine Photo:', machinePhoto)

    // Validation
    if (assetType === 'formal' && !selectedAsset) {
      toast.error("Selecciona un activo")
      console.error('Validation failed: No asset selected')
      return
    }

      if (assetType === 'exception' && !exceptionAssetName.trim()) {
      toast.error("Ingresa el nombre del equipo externo")
      return
    }

    if (!quantityLiters || parseFloat(quantityLiters) <= 0) {
      toast.error("Ingresa una cantidad válida de litros")
      return
    }

    if (!productId) {
      toast.error(`Error: No se encontró el producto ${productType === 'diesel' ? 'diesel' : 'UREA'}`)
      return
    }

    // Only require cuenta litros if warehouse has a meter
    if (previousCuentaLitros !== null && !cuentaLitros) {
      toast.error("Ingresa la lectura del cuenta litros")
      return
    }

    if (!selectedWarehouse) {
      toast.error("Selecciona un almacén")
      return
    }

    if (!machinePhotoDraftId) {
      toast.error("Toma una foto del display de la máquina")
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error("No hay sesión de usuario")
      return
    }
    const scopeErr = await validateDieselTransactionScope(supabase, {
      userId: user.id,
      selectedPlant,
      selectedWarehouse
    })
    if (scopeErr) {
      toast.error(scopeErr.error)
      return
    }

    if (isOnline && assetType === "formal" && selectedAsset?.id) {
      try {
        const validateRes = await fetch(
          `/api/diesel/validate-consumption-asset?asset_id=${encodeURIComponent(selectedAsset.id)}`
        )
        const validateJson = await validateRes.json().catch(() => ({}))
        if (!validateRes.ok || validateJson.ok === false) {
          toast.error(validateJson.error || "El equipo seleccionado no puede recibir combustible.")
          return
        }
      } catch (validateErr) {
        console.error("Consumption asset validation failed", validateErr)
        toast.error("No se pudo validar el equipo. Intenta de nuevo.")
        return
      }
    }

    // Pre-submit policy warning for out-of-order/backdated entries
    if (isOnline) {
      try {
        if (selectedWarehouse) {
          const selectedIso = new Date(transactionDate + "T" + transactionTime + ":00")
          const { data: latestTx } = await supabase
            .from("diesel_transactions")
            .select("transaction_date")
            .eq("warehouse_id", selectedWarehouse)
            .order("transaction_date", { ascending: false })
            .limit(1)
            .maybeSingle()

          const now = new Date()
          const deltaMinutes = Math.floor((now.getTime() - selectedIso.getTime()) / 60000)
          const isBackdated = deltaMinutes > backdatingThresholdMinutes
          const isOutOfOrder = latestTx?.transaction_date
            ? selectedIso.getTime() < new Date(latestTx.transaction_date).getTime()
            : false

          if (isBackdated || isOutOfOrder) {
            const proceed = confirm(
              "⚠️ Este movimiento será marcado para validación.\n\n" +
                "No cumple la política de control de diésel (posible amonestación).\n" +
                (isOutOfOrder ? "\n• Fuera de orden respecto a movimientos previos." : "") +
                (isBackdated ? `\n• Antidatado por ${deltaMinutes} min.` : "") +
                "\n\n¿Deseas continuar?"
            )
            if (!proceed) return
          }
        }
      } catch (warnErr) {
        console.warn("Pre-submit policy check failed", warnErr)
      }
    }

    if (
      previousCuentaLitros !== null &&
      cuentaLitrosValid === false &&
      cuentaLitrosVariance != null &&
      cuentaLitrosVariance > CUENTA_LITROS_VARIANCE_TOLERANCE_LITERS
    ) {
      const proceed = confirm(
        `⚠️ La diferencia entre litros y cuenta litros es de ${cuentaLitrosVariance.toFixed(1)}L.\n\n` +
          `Cantidad: ${quantityLiters}L\n` +
          `Movimiento cuenta litros: ${(parseFloat(cuentaLitros) - (previousCuentaLitros || 0)).toFixed(1)}L\n\n` +
          `¿Deseas continuar? La transacción será marcada para validación.`
      )
      if (!proceed) return
    }

    if (isOnline && selectedWarehouse) {
      const { data: warehouseData, error: warehouseError } = await supabase
        .from("diesel_warehouses")
        .select("current_inventory")
        .eq("id", selectedWarehouse)
        .single()

      if (warehouseError) {
        console.error("Error getting warehouse balance:", warehouseError)
        toast.error("Error al obtener el balance del almacén")
        return
      }

      const currentWarehouseBalance = warehouseData?.current_inventory || 0
      const estimatedBalance = currentWarehouseBalance - parseFloat(quantityLiters)

      if (currentWarehouseBalance > 0 && estimatedBalance < -50) {
        toast.error(
          `Balance insuficiente en el almacén. Balance actual: ${currentWarehouseBalance.toFixed(1)}L`
        )
        return
      }

      if (currentWarehouseBalance < 0 && estimatedBalance < currentWarehouseBalance - 100) {
        toast.warning(
          `Advertencia: El balance ya es negativo (${currentWarehouseBalance.toFixed(1)}L). Esta transacción lo hará más negativo.`
        )
      }
    }

    const plantIdForTx = resolveDieselTransactionPlantId(
      selectedPlant,
      selectedWarehouse,
      warehouses,
      allBuWarehouses
    )
    if (!plantIdForTx) {
      toast.error("No se pudo determinar la planta del almacén. Vuelve a seleccionar el almacén.")
      return
    }

    const transactionData = buildConsumptionTransactionData({
      plantIdForTx,
      selectedWarehouse,
      productId,
      assetType,
      selectedAsset,
      exceptionAssetName,
      quantityLiters,
      cuentaLitros,
      previousCuentaLitros,
      cuentaLitrosVariance,
      readings,
      transactionDate,
      transactionTime,
      notes,
      userId: user.id,
    })

    const assetName = assetType === "formal" ? selectedAsset?.name : exceptionAssetName

    let activeWipId = wipOutboxId
    const queuedId = await ensureConsumptionWipQueued({
      ...buildWipContext(),
      userId: user.id,
      productId,
      selectedWarehouse,
    })

    if (queuedId) {
      activeWipId = queuedId
      setWipOutboxId(queuedId)
    }

    const submitResult = await submitDurableDieselConsumption(
      activeWipId
        ? {
            transactionData: {},
            quantityLiters,
            cuentaLitros,
            isOnline,
            existingOutboxId: activeWipId,
          }
        : {
            transactionData,
            quantityLiters,
            cuentaLitros,
            photoPreviewUrl: machinePhoto,
            evidenceMetadata: machineEvidenceMetadata,
            isOnline,
          }
    )

    if (submitResult.status === "error") {
      toast.error("No se pudo guardar el consumo", {
        description: submitResult.message,
        duration: 8000,
      })
      return
    }

    const clearForm = () => {
      setSelectedAsset(null)
      setExceptionAssetName("")
      setQuantityLiters("")
      setCuentaLitros("")
      setCuentaLitrosManuallyEdited(false)
      setMachinePhoto(null)
      setMachinePhotoDraftId(null)
      setWipOutboxId(null)
      setDraftRecovered(false)
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current)
        previewObjectUrlRef.current = null
      }
      setMachineEvidenceMetadata(null)
      setNotes("")
      setReadings({})
      setPreviousCuentaLitros(null)
      setTransactionDate(getLocalDateString())
      setTransactionTime(getLocalTimeString())
    }

    if (submitResult.status === "synced") {
      if (assetType === "formal" && selectedAsset && (readings.hours_reading || readings.kilometers_reading)) {
        const updateData: Record<string, number> = {}
        if (readings.hours_reading) updateData.current_hours = readings.hours_reading
        if (readings.kilometers_reading) updateData.current_kilometers = readings.kilometers_reading
        const { error: updateError } = await supabase
          .from("assets")
          .update(updateData)
          .eq("id", selectedAsset.id)
        if (updateError) {
          console.error("Asset update error:", updateError)
        }
      }

      toast.success("✅ Consumo registrado exitosamente", {
        description: `${quantityLiters}L consumidos por ${assetName}`,
        duration: 4000,
      })

      if (previousCuentaLitros !== null && cuentaLitrosValid === false) {
        toast.warning("⚠️ Transacción marcada para validación", {
          description: "La diferencia con cuenta litros requiere revisión",
          duration: 5000,
        })
      }

      clearForm()
      void refreshPendingDieselCount()
      if (onSuccess) {
        onSuccess(submitResult.outboxId)
      }
      return
    }

    // Queued locally — data is safe on device; server sync pending or failed.
    clearForm()
    void refreshPendingDieselCount()

    if (!isOnline) {
      toast.success("Consumo guardado en el dispositivo", {
        description: `${quantityLiters}L para ${assetName}. Se sincronizará automáticamente al recuperar conexión.`,
        duration: 8000,
      })
      return
    }

    if (submitResult.waitResult === "failed") {
      toast.error("El consumo quedó guardado pero no se pudo sincronizar", {
        description:
          "Los datos están en este dispositivo. Usa «Sincronizar» en la barra de diesel o contacta a coordinación.",
        duration: 12000,
      })
      return
    }

    toast.warning("Consumo guardado — sincronización pendiente", {
      description: `${quantityLiters}L para ${assetName}. El servidor aún no confirmó el registro; no cierres la app hasta ver «En línea» sin pendientes.`,
      duration: 12000,
    })
    } catch (error) {
      console.error('=== ERROR CREATING CONSUMPTION ===')
      console.error('Error details:', error)
      console.error('Error type:', typeof error)
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }
      
      toast.error("Error al registrar el consumo", {
        description: describeDieselSaveError(error, "consumption"),
      })
    } finally {
      setLoading(false)
      submittingRef.current = false
      console.log('=== FORM SUBMISSION ENDED ===')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {(draftRecovered || wipOutboxId) && (
        <Alert className="border-blue-300 bg-blue-50">
          <CheckCircle2 className="h-4 w-4 text-blue-700" />
          <AlertTitle className="text-blue-900">
            {wipOutboxId
              ? "Consumo protegido en este dispositivo"
              : "Borrador recuperado"}
          </AlertTitle>
          <AlertDescription className="text-sm text-blue-800">
            {wipOutboxId
              ? "El formulario completo ya está guardado localmente. Si la app se cerró por memoria llena, tus datos siguen aquí — pulsa Registrar para confirmar en el servidor."
              : "Continúa el registro; los cambios se guardan automáticamente."}
          </AlertDescription>
        </Alert>
      )}

      {(pendingDieselSync > 0 || !isOnline) && (
        <Alert
          className={
            pendingDieselSync > 0
              ? "border-amber-300 bg-amber-50"
              : "border-orange-200 bg-orange-50"
          }
        >
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-900">
            {pendingDieselSync > 0
              ? `${pendingDieselSync} movimiento(s) de diesel pendiente(s) de sincronizar`
              : "Sin conexión a internet"}
          </AlertTitle>
          <AlertDescription className="text-sm text-amber-800 space-y-2">
            {pendingDieselSync > 0 ? (
              <p>
                Los consumos guardados en este dispositivo se enviarán al servidor automáticamente.
                No borres datos del navegador hasta que el indicador muestre «En línea» sin pendientes.
              </p>
            ) : (
              <p>
                Puedes registrar consumos: se guardarán en el dispositivo y se sincronizarán al volver en línea.
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <DieselOfflineStatus />
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Fuel className="h-5 w-5 text-orange-600" />
                Registrar Consumo de Diesel
              </CardTitle>
              <CardDescription>
                Registra el consumo de diesel y evidencia fotográfica
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Badge variant="outline" className="text-green-600">
                  <Wifi className="h-3 w-3 mr-1" />
                  En línea
                </Badge>
              ) : (
                <Badge variant="outline" className="text-orange-600">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Sin conexión
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Warehouse Selection */}
          <div className="space-y-4">
            <Label className="text-base">1. Seleccionar Almacén</Label>
            
            {/* Business Unit Selection */}
            {businessUnits.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="business-unit" className="text-sm">Unidad de Negocio</Label>
                <select
                  id="business-unit"
                  value={selectedBusinessUnit || ''}
                  onChange={(e) => handleBusinessUnitChange(e.target.value)}
                  disabled={loading}
                  className="w-full h-12 px-3 border border-gray-300 rounded-md text-base"
                >
                  <option value="">Seleccionar...</option>
                  {businessUnits.map(bu => (
                    <option key={bu.id} value={bu.id}>{bu.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Plant Selection */}
            {plants.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="plant" className="text-sm">Planta</Label>
                <select
                  id="plant"
                  value={selectedPlant || ''}
                  onChange={(e) => handlePlantChange(e.target.value)}
                  disabled={loading || (!selectedBusinessUnit && !accessProfile?.plant_id)}
                  className="w-full h-12 px-3 border border-gray-300 rounded-md text-base"
                >
                  <option value="">
                    {dieselBuWideMode ? 'Todas las plantas' : 'Seleccionar...'}
                  </option>
                  {plants.map(plant => (
                    <option key={plant.id} value={plant.id}>{plant.name} ({plant.code})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Warehouse Selection */}
            {warehouses.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="warehouse" className="text-sm">Almacén de Diesel</Label>
                <select
                  id="warehouse"
                  value={selectedWarehouse || ''}
                  onChange={(e) => handleWarehouseChange(e.target.value)}
                  disabled={loading || (!dieselBuWideMode && !selectedPlant)}
                  className="w-full h-12 px-3 border border-gray-300 rounded-md text-base"
                >
                  <option value="">Seleccionar...</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} - {wh.current_inventory ? `${wh.current_inventory.toFixed(1)}L` : '0L'}
                      {!wh.has_cuenta_litros ? ' (Sin cuenta litros)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {!dieselBuWideMode && !selectedPlant && plants.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Selecciona una planta para ver los almacenes disponibles
              </p>
            )}
            {dieselBuWideMode && warehouses.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Elige un almacén de tu unidad; la planta se asigna automáticamente. Puedes filtrar por planta arriba.
              </p>
            )}
            
            {!dieselBuWideMode && selectedPlant && warehouses.length === 0 && (
              <p className="text-sm text-orange-600">
                No hay almacenes disponibles en esta planta
              </p>
            )}
            {dieselBuWideMode && selectedPlant && warehouses.length === 0 && allBuWarehouses.length > 0 && (
              <p className="text-sm text-orange-600">
                No hay almacenes en la planta seleccionada
              </p>
            )}
            {dieselBuWideMode && allBuWarehouses.length === 0 && plants.length > 0 && (
              <p className="text-sm text-orange-600">
                No hay almacenes de {productType} en esta unidad
              </p>
            )}
          </div>

          {selectedWarehouse && (
            <>
              <Separator />

              {/* Asset Type Selection */}
              <div className="space-y-3">
                <Label className="text-base">2. Tipo de Equipo</Label>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAssetType('formal')
                      setExceptionAssetName("")
                    }}
                    className={`h-12 px-4 rounded-md border-2 font-medium transition-colors ${
                      assetType === 'formal'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    🏭 Equipo Propio
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setAssetType('exception')
                      setSelectedAsset(null)
                    }}
                    className={`h-12 px-4 rounded-md border-2 font-medium transition-colors ${
                      assetType === 'exception'
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    🚚 Equipo Externo
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  {assetType === 'formal' 
                    ? 'Equipos registrados en el sistema (tractores, excavadoras, etc.)'
                    : 'Equipos externos (socios, rentados, servicios públicos, etc.)'}
                </p>
              </div>

              <Separator />

              {/* Asset Selection - Formal */}
              {assetType === 'formal' && (
                <div className="space-y-2">
                  <Label className="text-base">3. Seleccionar Equipo</Label>
                  <AssetSelectorMobile
                    mode="consumption"
                    onSelect={setSelectedAsset}
                    selectedAssetId={selectedAsset?.id}
                    plantFilter={selectedPlant}
                    businessUnitFilter={false}
                  />
                </div>
              )}

              {/* Exception Asset Input */}
              {assetType === 'exception' && (
                <div className="space-y-2">
                  <Label htmlFor="exception-asset" className="text-base">
                    3. Nombre del Equipo Externo <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="exception-asset"
                    type="text"
                    placeholder="Ej: Camión de Socio ABC, Renta Equipo XYZ"
                    value={exceptionAssetName}
                    onChange={(e) => setExceptionAssetName(e.target.value)}
                    disabled={loading}
                    className="h-12 text-base"
                    required
                  />
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertDescription className="text-sm text-orange-800">
                      <strong>Nota:</strong> Los equipos externos no tienen lecturas de horómetro/odómetro.
                      Solo se registra la cantidad de litros y el cuenta litros.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </>
          )}

          {(selectedAsset || exceptionAssetName) && (
            <>
              <Separator />

              {/* Transaction Date and Time */}
              <div className="space-y-4">
                <Label className="text-base">4. Fecha y Hora del Consumo</Label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="transaction-date" className="text-sm">Fecha</Label>
                    <Input
                      id="transaction-date"
                      type="date"
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      disabled={loading}
                      max={getLocalDateString()}
                      className="h-12 text-base"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="transaction-time" className="text-sm">Hora</Label>
                    <Input
                      id="transaction-time"
                      type="time"
                      value={transactionTime}
                      onChange={(e) => setTransactionTime(e.target.value)}
                      disabled={loading}
                      className="h-12 text-base"
                      required
                    />
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Fecha y hora en que se realizó el consumo de diesel
                </p>
              </div>

              <Separator />

              {/* Quantity Input */}
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-base">
                  5. Cantidad de Litros Consumidos
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="Ej: 150.5"
                  value={quantityLiters}
                  onChange={(e) => setQuantityLiters(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault()
                    }
                  }}
                  disabled={loading}
                  className="h-12 text-lg font-semibold"
                  required
                />
                {quantityLiters && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingDown className="h-4 w-4" />
                    <span>{parseFloat(quantityLiters).toFixed(1)} litros serán descontados del inventario</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Cuenta Litros Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cuenta-litros" className="text-base font-semibold">
                    6. Lectura Cuenta Litros {previousCuentaLitros === null ? "(No disponible)" : ""}
                    {previousCuentaLitros !== null && <span className="text-red-600 ml-1">*</span>}
                  </Label>
                  {previousCuentaLitros !== null && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Anterior: {previousCuentaLitros.toFixed(1)}L
                      </Badge>
                      {getSuggestedCuentaLitros() && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => {
                            const suggested = getSuggestedCuentaLitros()
                            if (suggested) {
                              setCuentaLitros(suggested)
                              setCuentaLitrosManuallyEdited(false)
                              toast.info("Valor sugerido aplicado", {
                                description: "Verifica que coincida con la lectura real del medidor y corrígela si es necesario.",
                                duration: 4000
                              })
                            }
                          }}
                        >
                          Usar sugerido: {getSuggestedCuentaLitros()}L
                        </Button>
                      )}
                    </div>
                  )}
                  {previousCuentaLitros === null && (
                    <Badge variant="secondary" className="text-xs">
                      Sin medidor
                    </Badge>
                  )}
                </div>
                
                {/* IMPORTANCE MESSAGE */}
                {previousCuentaLitros !== null && (
                  <Alert className="border-blue-500 bg-blue-50">
                    <AlertTriangle className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-900 font-semibold">⚠️ CAMPO CRÍTICO PARA VALIDACIÓN</AlertTitle>
                    <AlertDescription className="text-blue-800 text-sm">
                      <strong>Este campo es esencial para validar la transacción.</strong> La lectura del cuenta litros debe coincidir con la cantidad de litros consumidos. 
                      <strong className="block mt-1">DEBES verificar la lectura REAL del medidor físico y corregir el valor si no coincide.</strong>
                      Sin esta validación correcta, la transacción será marcada para revisión manual.
                    </AlertDescription>
                  </Alert>
                )}
                
                <Input
                  id="cuenta-litros"
                  type="tel"
                  pattern="[0-9]*\.?[0-9]*"
                  inputMode="decimal"
                  placeholder={previousCuentaLitros !== null ? `Ingresa la lectura REAL del cuenta litros (sugerido: ${getSuggestedCuentaLitros() || 'N/A'}L)` : "N/A - Este almacén no tiene cuenta litros"}
                  value={cuentaLitros}
                  onChange={(e) => {
                    // Only allow numbers and decimal point
                    const value = e.target.value.replace(/[^0-9.]/g, '')
                    setCuentaLitros(value)
                    // Mark as manually edited if user types something
                    if (value && previousCuentaLitros !== null) {
                      setCuentaLitrosManuallyEdited(true)
                    }
                  }}
                  disabled={loading || previousCuentaLitros === null}
                  className={`h-12 text-base font-medium ${
                    previousCuentaLitros === null ? 'bg-gray-100 text-gray-500' :
                    cuentaLitrosValid === false ? 'border-red-500 bg-red-50 border-2' : 
                    cuentaLitrosValid === true ? 'border-green-500 bg-green-50 border-2' : 'border-blue-500 border-2'
                  }`}
                  required={previousCuentaLitros !== null}
                />
                
                {previousCuentaLitros !== null && getSuggestedCuentaLitros() && !cuentaLitros && (
                  <Alert className="border-yellow-500 bg-yellow-50">
                    <AlertDescription className="text-yellow-800 text-sm">
                      💡 <strong>Puedes usar el botón "Usar sugerido"</strong> para llenar automáticamente, pero <strong>SIEMPRE verifica con el medidor físico</strong> y corrígela si es necesario. 
                      Esta validación es crítica para la precisión del inventario.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Cuenta Litros Validation */}
                {cuentaLitros && previousCuentaLitros !== null && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Movimiento cuenta litros:</span>
                      <span className="font-semibold">
                        {(parseFloat(cuentaLitros) - previousCuentaLitros).toFixed(1)}L
                      </span>
                    </div>

                    {cuentaLitrosVariance !== null && (
                      <Alert className={
                        cuentaLitrosValid === true ? 'border-green-500 bg-green-50' :
                        cuentaLitrosValid === false ? 'border-red-500 bg-red-50' : ''
                      }>
                        {cuentaLitrosValid === true ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertTitle className="text-green-800 font-semibold">✅ Validación Correcta</AlertTitle>
                            <AlertDescription className="text-green-800 text-sm">
                              La lectura del cuenta litros coincide con los litros consumidos (varianza: {cuentaLitrosVariance.toFixed(1)}L).
                              La transacción puede proceder sin problemas.
                            </AlertDescription>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertTitle className="text-red-800 font-semibold">⚠️ DISCREPANCIA DETECTADA - REQUIERE VALIDACIÓN</AlertTitle>
                            <AlertDescription className="text-red-800 text-sm">
                              <strong>La diferencia entre litros consumidos y movimiento del cuenta litros es de {cuentaLitrosVariance.toFixed(1)}L.</strong>
                              <br /><br />
                              Esto puede indicar:
                              <ul className="list-disc list-inside mt-1 space-y-1">
                                <li>Error en la lectura del cuenta litros</li>
                                <li>Error en la cantidad de litros ingresada</li>
                                <li>Problema con el medidor</li>
                              </ul>
                              <strong className="block mt-2">Esta transacción será marcada para validación manual.</strong>
                              Verifica ambos valores antes de continuar.
                            </AlertDescription>
                          </>
                        )}
                      </Alert>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Asset Readings - Only for formal assets */}
              {assetType === 'formal' && selectedAsset && (
                <div className="space-y-2">
                  <Label className="text-base">6. Lecturas del Activo</Label>
                  <ReadingCapture
                    assetId={selectedAsset.id}
                    assetName={selectedAsset.name}
                    maintenanceUnit={selectedAsset.equipment_models?.maintenance_unit || 'hours'}
                    currentHours={selectedAsset.current_hours}
                    currentKilometers={selectedAsset.current_kilometers}
                    onReadingsChange={setReadings}
                    disabled={loading}
                  />
                </div>
              )}

              <Separator />

              {/* Evidence Photo */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">
                  {assetType === 'formal' ? '7' : '6'}. Evidencia Fotográfica <span className="text-red-600">*</span>
                </Label>

                {/* IMPORTANCE MESSAGE FOR PHOTO */}
                <Alert className="border-blue-500 bg-blue-50">
                  <Camera className="h-4 w-4 text-blue-600" />
                  <AlertTitle className="text-blue-900 font-semibold">📸 FOTO OBLIGATORIA PARA VALIDACIÓN</AlertTitle>
                  <AlertDescription className="text-blue-800 text-sm">
                    <strong>Esta foto es CRÍTICA para validar la transacción.</strong> Debe mostrar claramente:
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Los <strong>litros despachados</strong> en el display</li>
                      <li>La lectura del <strong>cuenta litros</strong> en el display</li>
                    </ul>
                    <strong className="block mt-2">Sin esta foto, la transacción NO puede ser validada correctamente.</strong>
                    Asegúrate de que la foto sea clara y legible.
                  </AlertDescription>
                </Alert>

                {/* Machine Display Photo */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-blue-600" />
                    <Label htmlFor="machine-photo" className="text-sm font-semibold">
                      Foto: Display de la Máquina <span className="text-red-600">*</span>
                    </Label>
                  </div>
                  <SmartPhotoUpload
                    checklistId={`diesel-consumption-${assetType === 'formal' ? selectedAsset?.id : exceptionAssetName || 'exception'}`}
                    itemId="machine-display"
                    currentPhotoUrl={machinePhoto}
                    onPhotoChange={(url, _id, meta) => {
                      setMachinePhoto(url)
                      setMachineEvidenceMetadata(meta ?? null)
                    }}
                    onStagingPhotoSaved={(photoDraftId) => {
                      setMachinePhotoDraftId(photoDraftId)
                      void flushDraftNow()
                      void flushWipNow()
                    }}
                    dieselStaging
                    disabled={loading}
                    category="machine_display"
                  />
                  {!machinePhotoDraftId && (
                    <Alert className="border-yellow-500 bg-yellow-50">
                      <AlertDescription className="text-yellow-800 text-sm">
                        ⚠️ <strong>Foto requerida:</strong> La foto del display es obligatoria. Debe mostrar claramente los litros despachados y el cuenta litros para validar la transacción.
                      </AlertDescription>
                    </Alert>
                  )}
                  {machinePhoto && (
                    <p className="text-xs text-green-700 font-medium">
                      ✅ Foto capturada. Verifica que se vean claramente los litros despachados y el cuenta litros.
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-base">
                  {assetType === 'formal' ? '8' : '7'}. Notas u Observaciones (Opcional)
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Agrega cualquier observación relevante..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                  rows={3}
                  className="text-base"
                />
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel || (() => router.back())}
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          
          <Button
            type="submit"
            disabled={loading || !selectedWarehouse || (assetType === 'formal' && !selectedAsset) || (assetType === 'exception' && !exceptionAssetName) || !quantityLiters || (previousCuentaLitros !== null && !cuentaLitros) || !machinePhotoDraftId}
            className="flex-1 sm:flex-none"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Registrar Consumo
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

