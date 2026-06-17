'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { RoleGuard } from '@/components/auth/role-guard'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { displayProfileName } from '@/lib/departments/department-membership'

type Plant = { id: string; name: string }
type Department = { id: string; name: string; code: string; plant_id: string; supervisor_id: string | null }
type Profile = { id: string; nombre: string | null; apellido: string | null; departamento: string | null; plant_id: string | null }
type Membership = {
  profile_id: string
  department_id: string
  role: string
  source: string
  profiles: Profile | null
  departments: Department | null
}

export function DepartmentMembershipBoard() {
  const { toast } = useToast()
  const [plants, setPlants] = useState<Plant[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [plantId, setPlantId] = useState<string>('')
  const [departmentId, setDepartmentId] = useState<string>('')
  const [addProfileId, setAddProfileId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [migrationPending, setMigrationPending] = useState(false)

  const plantDepartments = useMemo(
    () => departments.filter((dept) => !plantId || dept.plant_id === plantId),
    [departments, plantId],
  )

  const plantProfiles = useMemo(
    () => profiles.filter((profile) => !plantId || profile.plant_id === plantId),
    [profiles, plantId],
  )

  const visibleMemberships = useMemo(() => {
    return memberships.filter((row) => {
      if (plantId && row.departments?.plant_id !== plantId) return false
      if (departmentId && row.department_id !== departmentId) return false
      return true
    })
  }, [memberships, plantId, departmentId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const [plantsRes, profilesRes, membershipsRes, deptResult] = await Promise.all([
        fetch('/api/plants').then((r) => r.json()),
        fetch('/api/operators/register').then((r) => r.json()),
        fetch('/api/departments/memberships').then((r) => r.json()),
        supabase
          .from('departments')
          .select('id, name, code, plant_id, supervisor_id')
          .order('name'),
      ])

      setPlants(plantsRes.plants ?? [])
      setProfiles(profilesRes.operators ?? [])
      setMemberships(membershipsRes.memberships ?? [])
      setMigrationPending(!!membershipsRes.migration_pending)
      if (!deptResult.error && deptResult.data) setDepartments(deptResult.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const addMembership = async () => {
    if (!addProfileId || !departmentId) return
    setSaving(true)
    try {
      const res = await fetch('/api/departments/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: addProfileId, department_id: departmentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo agregar')
      toast({ title: 'Miembro agregado al departamento' })
      setAddProfileId('')
      await load()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo agregar',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const removeMembership = async (profileId: string, deptId: string) => {
    setSaving(true)
    try {
      const res = await fetch(
        `/api/departments/memberships?profile_id=${profileId}&department_id=${deptId}`,
        { method: 'DELETE' },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo quitar')
      toast({ title: 'Miembro removido' })
      await load()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo quitar',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {migrationPending && (
        <Alert>
          <AlertDescription>
            La migración de membresías aún no está aplicada. Las asignaciones usan el campo legado{' '}
            <code>profiles.departamento</code> hasta que RH aplique la migración.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="w-52">
          <p className="text-sm text-muted-foreground mb-1">Planta</p>
          <Select value={plantId || 'all'} onValueChange={(v) => setPlantId(v === 'all' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las plantas</SelectItem>
              {plants.map((plant) => (
                <SelectItem key={plant.id} value={plant.id}>
                  {plant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-56">
          <p className="text-sm text-muted-foreground mb-1">Departamento</p>
          <Select
            value={departmentId || 'all'}
            onValueChange={(v) => setDepartmentId(v === 'all' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {plantDepartments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.code} — {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agregar miembro</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="w-64">
            <p className="text-sm text-muted-foreground mb-1">Persona</p>
            <Select value={addProfileId || 'none'} onValueChange={(v) => setAddProfileId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seleccionar</SelectItem>
                {plantProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {displayProfileName(profile)}
                    {profile.departamento ? ` · ${profile.departamento}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => void addMembership()} disabled={saving || !addProfileId || !departmentId}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Agregar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Membresías ({visibleMemberships.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Persona</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleMemberships.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Sin membresías en el filtro actual. Use el backfill de migración o agregue manualmente.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleMemberships.map((row) => (
                    <TableRow key={`${row.profile_id}-${row.department_id}`}>
                      <TableCell>
                        {row.profiles ? displayProfileName(row.profiles) : row.profile_id}
                      </TableCell>
                      <TableCell>
                        {row.departments
                          ? `${row.departments.code} — ${row.departments.name}`
                          : row.department_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.role === 'supervisor' ? 'default' : 'secondary'}>
                          {row.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.source}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void removeMembership(row.profile_id, row.department_id)}
                          disabled={saving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function GestionDepartamentosView() {
  return (
    <RoleGuard module="personnel">
      <DashboardShell>
        <DashboardHeader
          heading="Departamentos de ruteo"
          text="Vincule personas a departamentos canónicos por planta (Mantenimiento, Operaciones, RH, Calidad). Base necesaria para asignación y SLA."
        />
        <DepartmentMembershipBoard />
      </DashboardShell>
    </RoleGuard>
  )
}
