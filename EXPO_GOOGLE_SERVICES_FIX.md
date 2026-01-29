# Expo google-services.json Configuration Fix

## Issue
Error: `Could not parse Expo config: android.googleServicesFile: "./google-services.json"`

## Solution

The `google-services.json` file must be:
1. ✅ Located in the **frontend root directory** (same level as `app.json`)
2. ✅ Referenced correctly in `app.json`

## Current Configuration

**File Location:**
- ✅ `frontend/google-services.json` (root directory)
- ✅ `frontend/android/app/google-services.json` (Android native folder - for native builds)

**app.json Configuration:**
```json
{
  "expo": {
    "android": {
      "googleServicesFile": "google-services.json"
    }
  }
}
```

## Verification Steps

1. **Check file exists:**
   ```bash
   cd frontend
   Test-Path "google-services.json"  # Should return True
   ```

2. **Verify JSON is valid:**
   ```bash
   Get-Content "google-services.json" | ConvertFrom-Json
   ```

3. **Clear Expo cache:**
   ```bash
   npx expo start --clear
   ```

## Alternative Solutions

### Option 1: Use Relative Path (Current)
```json
"googleServicesFile": "google-services.json"
```

### Option 2: Use Full Relative Path
```json
"googleServicesFile": "./google-services.json"
```

### Option 3: If Still Not Working
1. Delete `.expo` folder
2. Delete `node_modules/.cache`
3. Run `npx expo start --clear`

## For EAS Builds

If using EAS Build, ensure:
1. File is **not** in `.gitignore` (or use EAS Secrets)
2. File path is correct relative to project root
3. File is committed to Git (for EAS to access it)

## Troubleshooting

If error persists:
1. Verify file exists: `ls frontend/google-services.json`
2. Check file permissions
3. Try absolute path (not recommended)
4. Check Expo SDK version compatibility
5. Clear Expo cache: `npx expo start --clear`

## Note

The error might be a **warning** rather than a fatal error. Check if Expo actually starts despite the message. Some Expo versions show this warning but still work correctly.
