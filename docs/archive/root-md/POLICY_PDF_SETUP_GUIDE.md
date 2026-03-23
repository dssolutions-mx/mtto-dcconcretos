# Policy PDF Setup Guide

## Where to Place the Policy PDF

You have **two options** for storing the policy PDF:

---

## Option 1: Public Folder (Recommended - Simplest)

### Steps:

1. **Create the policies folder** in the `public` directory:
   ```bash
   mkdir -p public/policies
   ```

2. **Copy your PDF file** to the folder:
   ```bash
   cp "POL-OPE-001. POLITICA DE MANTENIMIENTO. (2).pdf" public/policies/POL-OPE-001.pdf
   ```
   
   Or manually:
   - Create folder: `public/policies/`
   - Copy the PDF file there
   - Rename it to: `POL-OPE-001.pdf` (remove spaces and special characters)

3. **Verify the database URL** is correct:
   ```sql
   SELECT document_url FROM policies WHERE code = 'POL-OPE-001';
   -- Should be: /policies/POL-OPE-001.pdf
   ```

4. **Access URL**: The PDF will be accessible at:
   ```
   http://your-domain.com/policies/POL-OPE-001.pdf
   ```

### ✅ Advantages:
- Simple and fast
- No additional setup needed
- Works immediately
- No storage costs

### ⚠️ Considerations:
- PDF is publicly accessible (anyone with the URL can view it)
- File is included in the build/deployment

---

## Option 2: Supabase Storage (More Secure)

### Steps:

1. **Create a storage bucket** for policies (if it doesn't exist):
   ```sql
   -- In Supabase Dashboard > Storage > Create Bucket
   -- Name: policies
   -- Public: true (or false with RLS policies)
   ```

2. **Upload the PDF** via Supabase Dashboard:
   - Go to Storage > policies bucket
   - Click "Upload file"
   - Upload `POL-OPE-001. POLITICA DE MANTENIMIENTO. (2).pdf`
   - Note the file path (e.g., `POL-OPE-001.pdf`)

3. **Get the public URL**:
   ```typescript
   // The URL will be:
   // https://[project-ref].supabase.co/storage/v1/object/public/policies/POL-OPE-001.pdf
   ```

4. **Update the database**:
   ```sql
   UPDATE policies 
   SET document_url = 'https://[project-ref].supabase.co/storage/v1/object/public/policies/POL-OPE-001.pdf'
   WHERE code = 'POL-OPE-001';
   ```

### ✅ Advantages:
- Can be private (with RLS)
- Better for large files
- Can track access/downloads
- Can update without rebuilding app

### ⚠️ Considerations:
- Requires Supabase Storage setup
- Need to configure RLS if private
- Slightly more complex

---

## ✅ Quick Setup (Option 1 - COMPLETED)

### ✅ 1. Folder Created:
```bash
✅ public/policies/ folder exists
```

### ✅ 2. PDF Copied:
```bash
✅ PDF copied to: public/policies/POL-OPE-001.pdf (3.9MB)
```

### ✅ 3. Database URL Verified:
```sql
✅ document_url: /policies/POL-OPE-001.pdf (correct!)
```

### 4. Test:
- Start your dev server: `npm run dev`
- Navigate to: `http://localhost:3000/policies/POL-OPE-001.pdf`
- Should see the PDF
- Or test in onboarding modal (clear localStorage and refresh)

---

## Current Database Status

The policy is already configured with:
- **document_url**: `/policies/POL-OPE-001.pdf`
- This expects the file at: `public/policies/POL-OPE-001.pdf`

---

## Verification

After placing the PDF, test it:

1. **Check file exists**:
   ```bash
   ls -la public/policies/POL-OPE-001.pdf
   ```

2. **Test in browser**:
   - Go to: `http://localhost:3000/policies/POL-OPE-001.pdf`
   - Should display/download the PDF

3. **Test in onboarding**:
   - Clear LocalStorage: `localStorage.removeItem('policy_acknowledged')`
   - Refresh page
   - Policy modal should appear
   - Click "Ver Documento Completo (PDF)" button
   - Should open the PDF

---

## Troubleshooting

### PDF not showing:
1. **Check file path**: Make sure it's exactly `public/policies/POL-OPE-001.pdf`
2. **Check file name**: No spaces, match exactly: `POL-OPE-001.pdf`
3. **Restart dev server**: Sometimes Next.js needs a restart to see new files
4. **Check browser console**: Look for 404 errors

### Database URL incorrect:
```sql
-- Update if needed:
UPDATE policies 
SET document_url = '/policies/POL-OPE-001.pdf'
WHERE code = 'POL-OPE-001';
```

### File too large:
- If PDF is > 10MB, consider:
  - Compressing the PDF
  - Using Supabase Storage instead
  - Splitting into multiple files

---

## File Structure

After setup, your structure should look like:
```
maintenance-dashboard/
├── public/
│   ├── policies/
│   │   └── POL-OPE-001.pdf  ← Your PDF here
│   ├── logo.png
│   └── ...
├── components/
├── app/
└── ...
```

---

## Next Steps

1. ✅ Place PDF in `public/policies/POL-OPE-001.pdf`
2. ✅ Restart dev server (if running)
3. ✅ Test the URL in browser
4. ✅ Test in onboarding modal
5. ✅ Verify it works for new users

The policy acknowledgment modal will automatically show the "Ver Documento Completo (PDF)" button once the `document_url` is set and the file is accessible.
