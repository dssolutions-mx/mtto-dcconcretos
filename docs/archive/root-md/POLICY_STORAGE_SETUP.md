# Policy Storage Setup - Supabase Bucket

## ✅ Storage Bucket Created

### Bucket Configuration
- **Bucket Name**: `policies`
- **Public Access**: ✅ Yes (users need to read policies)
- **File Size Limit**: 10MB
- **Allowed Types**: PDF only (`application/pdf`)

### RLS Policies
- ✅ **Public Read**: Anyone can read/download policy PDFs
- ✅ **Admin Upload**: Only GERENCIA_GENERAL and AREA_ADMINISTRATIVA can upload
- ✅ **Admin Update**: Only admins can update policy files
- ✅ **Admin Delete**: Only admins can delete policy files

---

## 📁 Folder Structure

The bucket uses this structure:
```
policies/
└── POL-OPE-001.pdf
```

For future policies:
```
policies/
├── POL-OPE-001.pdf
├── POL-OPE-002.pdf
└── ...
```

---

## 📤 How to Upload the PDF

### Option 1: Via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**:
   - Navigate to: https://supabase.com/dashboard/project/txapndpstzcspgxlybll/storage/buckets
   - Find the `policies` bucket
   - Click on it

2. **Upload the PDF**:
   - Click "Upload file" or drag & drop
   - Select: `POL-OPE-001. POLITICA DE MANTENIMIENTO. (2).pdf`
   - The file will be uploaded to the root of the bucket
   - **Recommended**: Rename it to `POL-OPE-001.pdf` after upload

3. **Get the Public URL**:
   - Click on the uploaded file
   - Copy the public URL (it will be):
     ```
     https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/POL-OPE-001.pdf
     ```

4. **Update Database**:
   ```sql
   UPDATE policies 
   SET document_url = 'https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/POL-OPE-001.pdf'
   WHERE code = 'POL-OPE-001';
   ```

### Option 2: Via Script (Automated)

I've created a script that will upload the PDF automatically:

```bash
# Install tsx if needed
npm install -D tsx

# Run the upload script
npx tsx scripts/upload-policy-pdf.ts
```

This script will:
- ✅ Find the PDF in the project root
- ✅ Upload it to the `policies` bucket
- ✅ Get the public URL
- ✅ Update the database automatically

---

## 🔗 Get Your Project URL

Your Supabase project URL is:
```
https://txapndpstzcspgxlybll.supabase.co
```

So the full PDF URL will be:
```
https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/POL-OPE-001.pdf
```

---

## 📝 Update Database After Upload

After uploading the PDF, update the database with the correct URL:

```sql
UPDATE policies 
SET document_url = 'https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/POL-OPE-001.pdf'
WHERE code = 'POL-OPE-001';
```

Or if you upload with a different name:
```sql
UPDATE policies 
SET document_url = 'https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/[your-file-name].pdf'
WHERE code = 'POL-OPE-001';
```

---

## ✅ Verification Steps

1. **Check bucket exists**:
   ```sql
   SELECT * FROM storage.buckets WHERE name = 'policies';
   ```

2. **Check RLS policies**:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'objects' 
   AND policyname LIKE '%policies%';
   ```

3. **Test URL** (after upload):
   - Open: `https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/POL-OPE-001.pdf`
   - Should download/display the PDF

4. **Test in onboarding**:
   - Clear LocalStorage: `localStorage.removeItem('policy_acknowledged')`
   - Refresh page
   - Policy modal should show PDF button
   - Click button → PDF should open

---

## 🎯 Next Steps

1. ✅ **Bucket Created** - `policies` bucket is ready
2. ✅ **RLS Policies Set** - Security configured
3. ⏳ **Upload PDF** - You need to upload via Supabase Dashboard
4. ⏳ **Update Database** - Set the `document_url` after upload
5. ✅ **Test** - Verify it works in onboarding

---

## 📋 Quick Reference

**Bucket Name**: `policies`  
**Public**: Yes  
**File Limit**: 10MB  
**Allowed Types**: PDF  
**Project URL**: `https://txapndpstzcspgxlybll.supabase.co`  
**Storage URL Pattern**: `https://txapndpstzcspgxlybll.supabase.co/storage/v1/object/public/policies/[filename].pdf`

---

## 🔒 Security Notes

- **Public Read**: Policies are public so users can access them without authentication
- **Admin Upload**: Only admins can upload/update/delete policies
- **RLS Enforced**: Database-level security ensures only authorized users can manage policies

---

**Status**: ✅ **BUCKET READY - AWAITING PDF UPLOAD**
