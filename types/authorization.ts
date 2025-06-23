// Authorization Delegation System Types

export interface AuthorizationLimit {
  id: string
  user_id: string
  granted_by_user_id: string | null  // null for system-assigned (General Manager)
  business_unit_id?: string
  plant_id?: string
  max_amount: number
  delegatable_amount: number  // How much they can further delegate
  created_at: string
  updated_at: string
  is_active: boolean
  notes?: string
}

export interface AuthorizationDelegation {
  id: string
  grantor_user_id: string      // Who is granting the authorization
  grantee_user_id: string      // Who is receiving the authorization
  original_limit_id: string    // Reference to the grantor's limit
  delegated_amount: number     // Amount being delegated
  business_unit_id?: string
  plant_id?: string
  created_at: string
  updated_at: string
  is_active: boolean
  notes?: string
}

export interface UserAuthorizationView {
  user_id: string
  user_name: string
  user_role: string
  business_unit_id?: string
  business_unit_name?: string
  plant_id?: string
  plant_name?: string
  total_authorization_limit: number
  self_authorization_limit: number  // What they can use themselves
  available_to_delegate: number     // What they can still delegate to others
  delegated_to_others: number       // What they've already delegated
  granted_by_user_id?: string
  granted_by_user_name?: string
  hierarchy_level: number           // 0 = General Manager, 1 = Business Unit, 2 = Plant, etc.
}

export interface AuthorizationHierarchyNode {
  user_id: string
  user_name: string
  user_role: string
  authorization_limit: number
  available_to_delegate: number
  children: AuthorizationHierarchyNode[]
  business_unit_id?: string
  plant_id?: string
}

export interface DelegationRequest {
  grantee_user_id: string
  delegated_amount: number
  business_unit_id?: string
  plant_id?: string
  notes?: string
}

export interface AuthorizationConfigUpdate {
  user_id: string
  new_limit: number
  business_unit_id?: string
  plant_id?: string
  notes?: string
}

// For the configuration interface
export interface OrganizationUnit {
  id: string
  name: string
  type: 'business_unit' | 'plant'
  parent_id?: string
  manager_user_id?: string
  manager_name?: string
}

export interface ConfigurationMatrix {
  business_units: {
    id: string
    name: string
    manager_user_id: string
    manager_name: string
    max_authorization_limit: number
    plants: {
      id: string
      name: string
      manager_user_id?: string
      manager_name?: string
    }[]
  }[]
} 