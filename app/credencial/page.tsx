"use client"

import { PersonalCredentialView } from '@/components/credentials/personal-credential-view'
import { RoleGuard } from '@/components/auth/role-guard'

export default function PersonalCredentialPage() {
  return (
    <RoleGuard module="profiles" requireRead>
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        <PersonalCredentialView />
      </div>
    </RoleGuard>
  )
}
