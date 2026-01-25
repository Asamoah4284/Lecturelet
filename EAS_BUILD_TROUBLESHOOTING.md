# EAS Build Upload Error - Troubleshooting Guide

## Error: `read ECONNRESET` / `MalformedSecurityHeader`

This error occurs when the upload to EAS Build fails due to network issues.

## Solutions (Try in order):

### 1. **Retry the Build** (Most Common Fix)
Network issues are often temporary. Simply retry:
```bash
cd frontend
eas build --platform android --profile preview
```

### 2. **Check Your Internet Connection**
- Ensure you have a stable internet connection
- Try switching networks (WiFi vs Mobile data)
- Check if your firewall/proxy is blocking Google Cloud Storage

### 3. **Reduce Upload Size** ✅ (Already Done)
I've created a `.easignore` file to exclude unnecessary files:
- Large media files (PDFs, WAV files)
- Documentation files
- Build artifacts
- Development files

This should reduce your upload from ~19.3 MB to a smaller size.

### 4. **Use a Different Network**
If you're on a corporate network or VPN:
- Try disconnecting from VPN
- Use a different network (mobile hotspot)
- Check if your network blocks Google Cloud Storage

### 5. **Check EAS Build Status**
Sometimes EAS Build services have issues:
- Check https://status.expo.dev for service status
- Check Expo Discord/Twitter for known issues

### 6. **Clear EAS Cache and Retry**
```bash
cd frontend
eas build:cancel  # Cancel any pending builds
eas build --platform android --profile preview --clear-cache
```

### 7. **Try Building with Different Profile**
If preview profile fails, try production:
```bash
eas build --platform android --profile production
```
(Note: This builds an AAB, not APK)

### 8. **Check File Size**
Verify the upload size is reasonable:
```bash
cd frontend
# Check what's being uploaded
eas build --platform android --profile preview --local
```

### 9. **Use EAS Build Local Option** (If network keeps failing)
Build locally instead of uploading:
```bash
cd frontend
eas build --platform android --profile preview --local
```
**Note:** This requires Android SDK and build tools installed locally.

## What I've Done:

✅ Created `.easignore` file to exclude:
- Large media files (PDFs, WAV files in assets/sounds)
- Documentation files
- Build artifacts
- Development files

This should significantly reduce your upload size and prevent timeouts.

## Next Steps:

1. **Retry the build** with the new `.easignore` file:
   ```bash
   cd frontend
   eas build --platform android --profile preview
   ```

2. If it still fails, try a different network or wait a few minutes and retry.

3. If the issue persists, check EAS Build status page or try building locally.
