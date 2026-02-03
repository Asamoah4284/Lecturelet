/**
 * API Configuration
 * - With backend: apiUrl is your backend base (e.g. http://10.25.105.72:3000/api).
 * - Firebase-only production: apiUrl is empty; app uses Firebase (Auth, Firestore, FCM) only.
 */
import Constants from 'expo-constants';

const rawApiUrl = Constants.expoConfig?.extra?.apiUrl ?? Constants.manifest?.extra?.apiUrl ?? Constants.manifest2?.extra?.apiUrl;

/**
 * API base URL. Empty string when using Firebase only (no backend).
 */
export const API_URL = rawApiUrl === '' || rawApiUrl == null ? '' : (rawApiUrl || 'http://localhost:3000/api');

/**
 * True when app is configured for Firebase-only (no backend URL).
 */
export const isFirebaseOnly = !API_URL || API_URL === '';

/**
 * Get Paystack public key from app.json configuration
 */
export const PAYSTACK_PUBLIC_KEY =
  Constants.expoConfig?.extra?.PAYSTACK_PUBLIC_KEY ||
  Constants.manifest?.extra?.PAYSTACK_PUBLIC_KEY ||
  Constants.manifest2?.extra?.PAYSTACK_PUBLIC_KEY ||
  null;

/**
 * Build full API URL for an endpoint.
 * When Firebase-only (API_URL empty), returns a placeholder so no request hits localhost.
 * @param {string} endpoint - e.g. 'auth/login'
 * @returns {string} Full URL or placeholder when no backend
 */
export const getApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  if (!API_URL) return `https://firebase-only.invalid/api/${cleanEndpoint}`;
  return `${API_URL}/${cleanEndpoint}`;
};

export default API_URL;








