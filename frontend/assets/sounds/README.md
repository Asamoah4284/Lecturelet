# Notification Sound Files

This directory contains the notification sound files for the app.

## Available Sound Files

The following sound files are currently available:

- `r1.wav` - Sound 1 (Bell/Chime style)
- `r2.wav` - Sound 2 (Ding style)
- `r3.wav` - Sound 3 (Pop style)

## Sound Options in App

Users can select from:
- **Default** - System default notification sound
- **Sound 1** - Uses `r1.wav`
- **Sound 2** - Uses `r2.wav`
- **Sound 3** - Uses `r3.wav`
- **None** - Silent (no sound)

## Sound File Requirements

### Format
- **iOS**: `.wav`, `.aiff`, or `.caf` format
- **Android**: `.wav`, `.mp3`, or `.ogg` format
- Recommended: `.wav` format (works on both platforms)

### Specifications
- **Duration**: 1-5 seconds recommended
- **Sample Rate**: 44.1 kHz or 48 kHz
- **Bit Depth**: 16-bit or 24-bit
- **Channels**: Mono or Stereo
- **File Size**: Keep under 500KB for best performance

### Where to Get Sound Files

You can find free notification sounds from:
- [Freesound.org](https://freesound.org) - Search for "notification", "bell", "chime", etc.
- [Zapsplat](https://www.zapsplat.com) - Free sound effects
- [Notification Sounds](https://notificationsounds.com) - Free notification sounds

### Adding Sound Files

1. Download or create the sound files
2. Convert to `.wav` format if needed (use Audacity or similar tool)
3. Place files in this directory: `frontend/assets/sounds/`
4. Update `app.json` if you add new sound files
5. Rebuild the app for changes to take effect

## Current Status

✅ **Custom sounds are enabled!** The app now uses the sound files from this directory.

- Local reminder notifications will play the selected custom sound
- Push notifications from the backend will use the system default sound (Expo push notifications don't support custom sound files)

## Adding More Sounds

To add more sound options:
1. Add new `.wav` files to this directory (e.g., `r4.wav`)
2. Update `SettingsScreen.js` to add the new sound option in the sound picker
3. Update `localReminderService.js` to map the new sound preference to the file
4. Rebuild the app for changes to take effect
