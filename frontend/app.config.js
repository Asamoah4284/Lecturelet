/**
 * Expo config. Used for all builds.
 * - Local dev: uses apiUrl from app.json (e.g. your local backend).
 * - Production: set EXPO_PUBLIC_API_URL in EAS Environment Variables to your
 *   deployed backend URL (e.g. https://your-app.onrender.com/api).
 *
 * The apiUrl is YOUR BACKEND API (Node/Express), not Firebase. Firebase (Auth,
 * Firestore, FCM) is used by your backend; the app still talks to your backend.
 */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiUrl:
      process.env.EXPO_PUBLIC_API_URL ||
      config.extra?.apiUrl ||
      'http://localhost:3000/api',
  },
});
