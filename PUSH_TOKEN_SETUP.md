# Push Token Setup - Fixing projectId Error

If you're getting the error: `No 'projectId' found`, here are the solutions:

## Solution 1: Set Up EAS (Recommended for Production)

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo:**
   ```bash
   eas login
   ```

3. **Initialize EAS in your project:**
   ```bash
   cd frontend
   eas init
   ```

4. **This will create an `eas.json` file and give you a projectId**

5. **Update app.json** - The projectId will be automatically available via Constants

## Solution 2: For Development/Expo Go (Quick Fix)

If you're just testing in Expo Go and don't want to set up EAS yet:

1. **Get your Expo username:**
   - Check your Expo account or use: `expo whoami`

2. **Add to app.json:**
   ```json
   {
     "expo": {
       "owner": "your-expo-username",
       "slug": "LectureLet"
     }
   }
   ```

3. **Or use experienceId approach** - The code will try to work without projectId in development

## Solution 3: Manual projectId (Temporary)

If you have an Expo project, you can manually add the projectId:

1. **Find your projectId:**
   - Go to https://expo.dev
   - Find your project
   - Copy the projectId from the URL or project settings

2. **Add to app.json:**
   ```json
   {
     "expo": {
       "extra": {
         "apiUrl": "http://10.48.213.72:3000/api",
         "eas": {
           "projectId": "your-project-id-here"
         }
       }
     }
   }
   ```

## Solution 4: Use Development Build (Best for Testing)

Instead of Expo Go, create a development build:

```bash
cd frontend
eas build --profile development --platform android
# or
eas build --profile development --platform ios
```

This will automatically configure projectId.

## Current Code Behavior

The updated code will:
1. Try to find projectId from multiple sources
2. If not found, attempt to work without it (may work in some Expo versions)
3. Log helpful error messages if it fails

## Testing

After setting up projectId:
1. Restart your Expo server: `npm start -- --clear`
2. Reload the app
3. Check console - should see "Push token registered successfully"

## Note

- **Expo Go**: May have limitations with push notifications
- **Development Build**: Full push notification support
- **Production Build**: Requires EAS projectId

