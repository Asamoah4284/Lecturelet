# Firebase Environment Variables Setup

## Overview
The Firebase configuration supports two methods for providing credentials. Choose the one that best fits your deployment environment.

## Option 1: Service Account File Path (Recommended for Development)

**Best for:** Local development, when you have the JSON file

Add to your `.env`:
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json
```

**Requirements:**
- The JSON file must be in the `backend` directory
- File name: `lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json`
- Make sure the file is in `.gitignore` (never commit service account keys!)

**Pros:**
- Easy to manage locally
- No need to escape JSON in environment variables
- Clear separation of credentials

**Cons:**
- Not ideal for production/CI/CD
- File must be present on the server

## Option 2: Service Account JSON String (Recommended for Production)

**Best for:** Production deployments, CI/CD, Docker containers, cloud platforms

Add to your `.env`:
```env
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"lecturelet-c03be","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
```

**How to convert JSON file to environment variable:**

1. **Read the JSON file:**
   ```bash
   cat backend/lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json
   ```

2. **Convert to single line (remove all newlines and escape quotes):**
   - Remove all line breaks
   - Escape double quotes: `"` becomes `\"`
   - Keep it as a single line

3. **Or use a tool:**
   ```bash
   # On Linux/Mac
   cat backend/lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json | jq -c
   
   # On Windows PowerShell
   Get-Content backend/lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json | ConvertFrom-Json | ConvertTo-Json -Compress
   ```

**Pros:**
- Works well in containerized environments
- No file management needed
- Secure for cloud deployments
- Can be set in platform environment variables (Render, Heroku, etc.)

**Cons:**
- Harder to read/edit
- Requires proper JSON escaping

## Current Setup

Based on your configuration, the system will:
1. First check for `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable
2. If not found, check for `FIREBASE_SERVICE_ACCOUNT_PATH` environment variable
3. If not found, default to `../../lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json` relative to the config file

## Security Best Practices

1. **Never commit service account keys to Git**
   - Add to `.gitignore`:
     ```
     *.json
     !package*.json
     .env
     ```

2. **Use environment variables in production**
   - Set `FIREBASE_SERVICE_ACCOUNT_KEY` in your hosting platform's environment variables
   - Don't hardcode credentials in code

3. **Rotate keys regularly**
   - Generate new service account keys periodically
   - Update environment variables when rotating

4. **Limit service account permissions**
   - Only grant necessary Firebase permissions
   - Use least privilege principle

## Verification

To verify your Firebase setup is working:

1. Start your backend server:
   ```bash
   cd backend
   npm start
   ```

2. Look for this message:
   ```
   ✅ Firebase Admin SDK initialized successfully
   ```

3. If you see an error, check:
   - File path is correct (if using Option 1)
   - JSON is valid (if using Option 2)
   - Environment variable is set correctly

## Troubleshooting

**Error: "Firebase service account key not found"**
- Check that `FIREBASE_SERVICE_ACCOUNT_PATH` points to the correct file
- Or ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is set correctly
- Verify the JSON file exists and is readable

**Error: "Invalid service account key"**
- Verify the JSON is valid
- Check that all required fields are present
- Ensure quotes are properly escaped (if using Option 2)

**Error: "Permission denied"**
- Check file permissions (if using Option 1)
- Verify service account has necessary Firebase permissions
