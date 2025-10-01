# Office Management for Credential Cards - Implementation Summary

## Overview
Successfully implemented a dynamic office management system for employee credential cards, replacing hardcoded company contact information with database-driven office data.

## Implementation Date
September 30, 2025

## Problem Statement
The credential card system had hardcoded company contact information (address, email, phone, HR phone), which was problematic for a company with multiple offices. Each employee's credential needed to display the correct office information based on their assignment.

## Solution
Created a complete office management system that allows:
1. Creating and managing multiple office records
2. Assigning employees to specific offices
3. Dynamically displaying office information on credential cards

---

## Database Changes

### New Table: `offices`
Created a new table to store office information:

```sql
CREATE TABLE offices (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    address TEXT NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    hr_phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Profile Table Update
Added `office_id` foreign key to profiles table:
- Column: `office_id UUID REFERENCES offices(id)`
- Index: `idx_profiles_office_id` for faster lookups

### Default Data
Inserted two default offices:
1. **Oficina Tijuana**
   - Address: Calle Caracas #12428, El Paraíso 22106
   - Email: rh.tj@dcconcretos.com.mx
   - Phone: 664 905 1813
   - RH: 477 288 0120

2. **Oficina Principal** (placeholder for second office)

**Migration File:** `/migrations/sql/20250930_create_offices_table.sql`

---

## Components Created

### 1. Office Management Modal
**File:** `components/credentials/office-management-modal.tsx`

**Features:**
- View all registered offices
- Create new offices
- Edit existing offices
- Delete offices (with confirmation)
- Form validation for all required fields

**Fields:**
- Office name
- Address
- Email
- Office phone
- HR phone

---

## Components Updated

### 1. Credential Card Component
**File:** `components/credentials/credential-card.tsx`

**Changes:**
- Removed hardcoded `defaultCompanyInfo` constant
- Updated interface to accept `Office` type
- Now retrieves office data from `employeeData.office`
- Falls back to default values if no office assigned
- Dynamically displays:
  - Office address
  - Office email
  - Office phone
  - HR phone

### 2. Employee Credentials Manager
**File:** `components/credentials/employee-credentials-manager.tsx`

**Changes:**
1. **State Management:**
   - Added `offices` state to store office list
   - Added `isOfficeModalOpen` state for modal control

2. **Data Fetching:**
   - Added `fetchOffices()` function
   - Updated employee query to include office data via `office_id` join
   - Fixed data mapping to properly handle array responses from Supabase

3. **UI Updates:**
   - Added "Gestionar Oficinas" button in header
   - Integrated `OfficeManagementModal` component
   - Updated `EmployeeCredentialEditForm` to include office selection

4. **Form Updates:**
   - Added office dropdown in the "Credenciales del Sistema" section
   - Office selection placed after system access password field
   - Includes helpful description text

5. **Save Handler:**
   - Updated to save `office_id` when updating employee credentials

### 3. Employee Interface
**Updated Interface Fields:**
```typescript
interface Employee {
  // ... existing fields ...
  office_id?: string;
  office?: Office;
}
```

---

## Type System Updates

### File: `types/index.ts`

Added Office types:
```typescript
export type Office = DbTables['offices']['Row'];
export type InsertOffice = DbTables['offices']['Insert'];
export type UpdateOffice = DbTables['offices']['Update'];
```

Updated Profile type to include office relation:
```typescript
export type Profile = DbTables['profiles']['Row'] & {
  // ... existing fields ...
  office?: Office;
};
```

---

## User Workflow

### Managing Offices

1. **Access:** Click "Gestionar Oficinas" button in credentials page header
2. **View:** See list of all registered offices with their information
3. **Create:**
   - Click "Nueva Oficina" button
   - Fill in all required fields
   - Click "Crear"
4. **Edit:**
   - Click pencil icon on office card
   - Modify fields as needed
   - Click "Actualizar"
5. **Delete:**
   - Click trash icon on office card
   - Confirm deletion
   - Note: Will affect employees assigned to that office

### Assigning Office to Employee

1. **Access:** Click "Editar" on an employee in the credentials table
2. **Navigate:** Scroll to "Credenciales del Sistema" section
3. **Select:** Choose office from "Oficina Asignada" dropdown
4. **Save:** Click save to update employee record

### Credential Card Display

- When employee has assigned office: Shows office's specific contact information
- When employee has no office: Shows default DC CONCRETOS information
- Information displayed:
  - Dirección (Address)
  - Correo (Email)
  - Teléfono (Office Phone)
  - RH (HR Phone)

---

## Benefits

1. **Centralized Management:** All office information in one place
2. **Scalability:** Easy to add new offices as company grows
3. **Accuracy:** Each employee's credential shows correct office information
4. **Maintainability:** Update office info in one place, reflects on all credentials
5. **Flexibility:** Employees can be reassigned to different offices as needed

---

## Technical Notes

### Database Relationships
- **One-to-Many:** One office can have many employees
- **Optional:** Employees can exist without office assignment (uses defaults)
- **Foreign Key:** Ensures referential integrity

### Query Optimization
- Added index on `profiles.office_id` for faster lookups
- Query includes office data in single database call (no N+1 queries)

### Type Safety
- Full TypeScript support throughout
- Proper type definitions for all Office operations
- Type-safe Supabase queries with generated types

### Error Handling
- Graceful fallback to default values if office not assigned
- Toast notifications for all CRUD operations
- Console error logging for debugging

### Data Validation
- All office fields are required
- Unique constraint on office name
- Form validation before submission

---

## Files Modified

1. **Migration:**
   - `/migrations/sql/20250930_create_offices_table.sql` (new)

2. **Components:**
   - `/components/credentials/credential-card.tsx` (updated)
   - `/components/credentials/employee-credentials-manager.tsx` (updated)
   - `/components/credentials/office-management-modal.tsx` (new)

3. **Types:**
   - `/types/index.ts` (updated)

---

## Testing Checklist

- [x] Database migration applied successfully
- [x] Offices table created with proper constraints
- [x] Default offices inserted
- [x] Office CRUD operations work correctly
- [x] Employee office assignment saves properly
- [x] Credential cards display office information correctly
- [x] Fallback to defaults when no office assigned works
- [x] All TypeScript types compile without errors
- [x] No linter errors in modified files

---

## Future Enhancements

Potential improvements for future iterations:

1. **Bulk Operations:** Assign multiple employees to office at once
2. **Office Logo:** Allow each office to have its own logo
3. **Office Hours:** Display office operating hours on credentials
4. **Multi-language:** Support for credential cards in multiple languages per office
5. **Audit Trail:** Track office assignment history
6. **Office Templates:** Pre-configure office settings for faster setup

---

## Support & Maintenance

### Common Issues

**Q: Employee credential shows wrong office**
A: Edit the employee and verify the correct office is selected in "Oficina Asignada"

**Q: Can't delete office**
A: Check if any employees are still assigned to that office. Reassign them first.

**Q: Office information not updating on credentials**
A: Make sure to save the employee record after changing office assignment.

### Database Backup
Remember to backup the `offices` table when performing system backups.

---

## Credits

Implemented by AI Assistant based on user requirements.
Project: DC CONCRETOS Maintenance Dashboard
Company: Centralized with multiple office locations

