# Policy Storage Setup - ✅ COMPLETE

## ✅ Storage Bucket Created and Configured

### Bucket Details
- **Name**: `policies`
- **Public**: ✅ Yes (users need public access to read policies)
- **File Size Limit**: 10MB
- **Allowed Types**: PDF only (`application/pdf`)
- **Status**: ✅ Ready for uploads

### RLS Policies Created
- ✅ **Public Read**: `Public read access to policies` (SELECT)
- ✅ **Admin Upload**: `Admins can upload policies` (INSERT)
- ✅ **Admin Update**: `Admins can update policies` (UPDATE)
- ✅ **Admin Delete**: `Admins can delete policies` (DELETE)

---

## 📤 Upload the PDF - Two Options

### Option 1: Via Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard**:
   ```
   https://supabase.com/dashboard/project/txapndpstzcspgxlybll/storage/buckets/policies
   ```

2. **Upload the PDF**:
   - Click "Upload file" button
   - Select: `POL-OPE-001. POLITICA DE MANTENIMIENTO. (2).pdf`
   - **Rename it to**: `POL-OPE-001.pdf` (recommended)

3. **Get the Public URL**:
   - After upload, click on the file
   - Copy the public URL:
     ```
     https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/POL-OPE-001.pdf
     ```

4. **Update Database**:
   ```sql
   UPDATE policies 
   SET document_url = 'https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/POL-OPE-001.pdf'
   WHERE code = 'POL-OPE-001';
   ```

### Option 2: Via Upload Script (Automated)

I've created a script that does everything automatically:

```bash
# Install tsx if needed (for running TypeScript)
npm install -D tsx

# Run the upload script
npx tsx scripts/upload-policy-pdf.ts
```

**What the script does**:
- ✅ Finds the PDF in project root
- ✅ Uploads to `policies` bucket as `POL-OPE-001.pdf`
- ✅ Gets the public URL automatically
- ✅ Updates the database automatically

---

## 🔗 Expected URL Format

After upload, the PDF will be accessible at:
```
https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/POL-OPE-001.pdf
```

---

## ✅ Verification

### 1. Check Bucket Exists:
```sql
SELECT * FROM storage.buckets WHERE name = 'policies';
-- Should return: policies bucket with public=true
```

### 2. Check RLS Policies:
```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE '%policies%';
-- Should return: 4 policies (SELECT, INSERT, UPDATE, DELETE)
```

### 3. Test URL (after upload):
- Open: `https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/POL-OPE-001.pdf`
- Should download/display the PDF

### 4. Test in Onboarding:
- Clear LocalStorage: `localStorage.removeItem('policy_acknowledged')`
- Refresh page
- Policy modal should appear
- Click "Ver Documento Completo (PDF)" button
- PDF should open from Supabase Storage

---

## 📋 Quick Reference

**Bucket**: `policies`  
**Project URL**: `https://txapndpstzcspgxlybll.supabase.co`  
**Storage Base URL**: `https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/`  
**PDF URL**: `https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/POL-OPE-001.pdf`

---

## 🎯 Next Steps

1. ✅ **Bucket Created** - `policies` bucket ready
2. ✅ **RLS Policies Set** - Security configured
3. ✅ **Upload Script Created** - Ready to use
4. ⏳ **Upload PDF** - Use Dashboard or script
5. ⏳ **Update Database** - Set `document_url` (script does this automatically)
6. ✅ **Test** - Verify it works

---

## 🔒 Security

- **Public Read**: Policies are publicly accessible (users need to read them)
- **Admin Only**: Only GERENCIA_GENERAL and AREA_ADMINISTRATIVA can upload/update/delete
- **RLS Enforced**: Database-level security ensures proper access control

---

**Status**: ✅ **BUCKET READY - UPLOAD PDF TO COMPLETE SETUP**
