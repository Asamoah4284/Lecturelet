# Notification Sound Files

This directory should contain the notification sound files for the app.

## Required Sound Files

To enable different notification sounds, add the following sound files to this directory:

- `default.wav` - Default notification sound
- `bell.wav` - Bell sound
- `chime.wav` - Chime sound  
- `ding.wav` - Ding sound
- `pop.wav` - Pop sound

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

⚠️ **Note**: Currently, all sound options use the system default sound because custom sound files have not been added yet. 

To enable different sounds:
1. Add the sound files listed above
2. Rebuild the app
3. The different sound options will then play their respective sounds
