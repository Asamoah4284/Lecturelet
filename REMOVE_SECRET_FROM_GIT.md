# Remove Firebase service account key from Git history

GitHub blocked your push because the file `frontend/lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json` (Google Cloud credentials) was committed. **Never commit service account keys**—use environment variables or secure secret storage instead.

## Step 1: Stop tracking the key file (keep it on your machine)

Run from the **project root** (`C:\Projects\lecturerlet`):

```bash
git rm --cached frontend/lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json
git rm --cached backend/lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json
```

(If one path says "did not match any files", that's fine—only remove the one that exists in git.)

## Step 2: Stage .gitignore changes

```bash
git add frontend/.gitignore backend/.gitignore
```

## Step 3: Remove the file from the commit that added it

**If the secret was added in your most recent commit:**

```bash
git commit --amend --no-edit
```

**If the secret was added in an older commit** (e.g. you have several new commits after it):

```bash
git rebase -i 9dca503^
```

In the editor, change `pick` to `edit` for the line with commit `9dca503`, save and close. Then run:

```bash
git rm --cached frontend/lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json
git add frontend/.gitignore backend/.gitignore
git commit --amend --no-edit
git rebase --continue
```

## Step 4: Push again

```bash
git push origin firebase-backend
```

---

**Important:** The JSON key file remains on your computer (we only removed it from git). For production, use **Firebase environment variables** (see below) and never commit the file.

---

## Production: will it work?

**Yes.** The backend is already set up to use environment variables in production. It does **not** need the JSON file in the repo.

### How it works

1. **Local/dev:** Use the JSON file on your machine (e.g. `backend/lecturelet-c03be-firebase-adminsdk-....json`) or set `FIREBASE_SERVICE_ACCOUNT_KEY` in `backend/.env`.
2. **Production (Render, Railway, etc.):** Set the following **environment variables** in your host’s dashboard. No file is deployed.

### Production environment variables

Set these in your hosting provider (e.g. Render → Service → Environment):

| Variable | Value | Required |
|----------|--------|----------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | The **entire contents** of your Firebase service account JSON as a **single-line string** (copy the JSON and minify it, or paste and let the host store it). | Yes, for Firebase (Auth, Firestore, Storage, FCM) |
| `FIREBASE_STORAGE_BUCKET` | `lecturelet-c03be.firebasestorage.app` | Yes, for course materials uploads |
| `PORT` | e.g. `3000` (or whatever your host uses) | Yes |
| `JWT_SECRET` | Your secret for auth | Yes |
| Any others | Paystack, Moolre, etc. | As needed |

### Getting the JSON as a single line

- **Option A:** Open the `.json` file, copy all, then use a minifier (e.g. [jsonformatter.org](https://jsonformatter.org/json-minify)) and paste the result into `FIREBASE_SERVICE_ACCOUNT_KEY`.
- **Option B:** In the shell (from the folder containing the JSON file):  
  `cat lecturelet-c03be-firebase-adminsdk-fbsvc-b73708ead1.json | jq -c .`  
  Copy the output and set that as `FIREBASE_SERVICE_ACCOUNT_KEY`.

The backend checks `FIREBASE_SERVICE_ACCOUNT_KEY` first; if it’s set, it never looks for a file. So production will work as long as you set these env vars on your host.
