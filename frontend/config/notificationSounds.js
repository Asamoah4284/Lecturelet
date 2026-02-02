/**
 * Notification sounds from assets/sounds folder.
 * app.json expo-notifications plugin copies these to Android res/raw and iOS bundle.
 * All references to r1.wav, r2.wav, r3.wav should come from this config.
 */

export const NOTIFICATION_SOUND_IDS = ['r1', 'r2', 'r3'];

/** Filenames in assets/sounds/ (used for channel + notification content) */
export const NOTIFICATION_SOUND_FILES = {
  r1: 'r1.wav',
  r2: 'r2.wav',
  r3: 'r3.wav',
};

/** Paths for app.json expo-notifications "sounds" (relative to frontend project root) */
export const NOTIFICATION_SOUND_PATHS = [
  './assets/sounds/r1.wav',
  './assets/sounds/r2.wav',
  './assets/sounds/r3.wav',
];

/** Check if value is a custom sound id (r1, r2, r3) */
export const isCustomSoundId = (value) =>
  typeof value === 'string' && NOTIFICATION_SOUND_IDS.includes(value);

/** Get sound filename for channel/notification (e.g. r1 -> r1.wav) */
export const getSoundFileName = (soundId) =>
  NOTIFICATION_SOUND_FILES[soundId] || null;
