"use client"

import { EmployeeCredentialsManager } from '@/components/credentials/employee-credentials-manager'
import { RoleGuard } from '@/components/auth/role-guard'

export default function CredentialsManagementPage() {
  return (
    <RoleGuard 
      module="personnel"
    >
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <EmployeeCredentialsManager />
      </div>
    </RoleGuard>
  )
}
