/**
 * Expo config. Used for all builds.
 *
 * Firebase-only production (no backend):
 * - Set EXPO_PUBLIC_API_URL="" in EAS Environment Variables for production profile,
 *   or leave apiUrl empty. App uses Firebase (Auth, Firestore, FCM) only; no backend calls.
 *
 * Local dev with backend:
 * - Set apiUrl in app.json to your local backend (e.g. http://10.25.105.72:3000/api).
 */
module.exports = ({ config }) => {
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const appJsonApiUrl = config.extra?.apiUrl;
  const apiUrl =
    envApiUrl !== undefined
      ? (envApiUrl === '' ? '' : envApiUrl)
      : (appJsonApiUrl || 'http://localhost:3000/api');
  return {
    ...config,
    extra: {
      ...config.extra,
      apiUrl,
    },
  };
};
