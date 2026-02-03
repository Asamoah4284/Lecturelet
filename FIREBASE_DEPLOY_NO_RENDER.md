# Run Your Backend on Firebase (No Render)

Your Express backend is set up to run on **Firebase Cloud Functions**. After deployment, point your app to the function URL and you don't need Render.

---

## 1. One-time setup

### Install Firebase CLI (if needed)

```bash
npm install -g firebase-tools
firebase login
```

### Set Firebase config (secrets for your backend)

Your backend needs the same env vars it uses locally. Set them in Firebase:

```bash
# From project root
firebase functions:config:set \
  moolre.api_key="YOUR_MOOLRE_API_KEY" \
  moolre.sender_id="LectureLet"
```

For the Firebase service account (needed for Admin SDK in Cloud Functions), Firebase provides **default credentials** when the function runs, so you don't set `FIREBASE_SERVICE_ACCOUNT_KEY` in production.

For any other env vars your backend reads (e.g. from `process.env`), use Firebase environment config or **Firebase Functions secrets**:

```bash
firebase functions:secrets:set MOOLRE_API_KEY
# (enter value when prompted)
```

Then in your backend code, read secrets in Cloud Functions via `process.env` if you use `defineSecret` in the function, or keep using `functions.config()` for non-sensitive config.

**Simpler option:** keep using `process.env`. Set env in the Firebase Console:  
Project → Functions → your function → Environment variables / Secrets.

---

## 2. Deploy

From the **project root** (not inside `functions`):

```bash
# Copy backend into functions (runs automatically via predeploy)
node scripts/copy-backend-to-functions.js

# Install function dependencies
cd functions && npm install && cd ..

# Deploy
firebase deploy --only functions
```

`firebase.json` is set up so `firebase deploy --only functions` runs the copy script first (predeploy), then deploys.

---

## 3. Get your API URL

After deploy you’ll see something like:

```
Function URL (api): https://us-central1-lecturelet-c03be.cloudfunctions.net/api
```

Your **API base URL** for the app is that URL (it already includes `/api`):

- `https://us-central1-lecturelet-c03be.cloudfunctions.net/api`

(Use your actual project ID and region if different.)

---

## 4. Point the app to Firebase (production)

### Option A – EAS (recommended)

1. In [expo.dev](https://expo.dev) → your project → **Secrets** or **Environment variables**.
2. For the **production** profile, add:
   - **Name:** `EXPO_PUBLIC_API_URL`
   - **Value:** `https://us-central1-lecturelet-c03be.cloudfunctions.net/api`
3. Build:  
   `eas build --platform all --profile production`

### Option B – app.json for production

In `frontend/app.json`, set `extra.apiUrl` to the same URL for production builds (or use a separate config for prod).

---

## 5. Local development

- Keep using your **local backend** (e.g. `http://10.25.105.72:3000/api` in `app.json` or leave `EXPO_PUBLIC_API_URL` unset).
- Production builds use the Cloud Function URL from step 4.

---

## Summary

| Environment   | API URL |
|---------------|--------|
| Local dev     | `http://YOUR_IP:3000/api` (in app.json) |
| Production    | `https://us-central1-lecturelet-c03be.cloudfunctions.net/api` (set in EAS or app.json) |

No Render needed: production uses Firebase Cloud Functions as your backend host.
