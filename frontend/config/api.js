/**
 * API Configuration
 * Global API URL configuration for connecting to the backend
 */
import Constants from 'expo-constants';

/**
 * Get the API base URL from app.json configuration
 * Falls back to localhost if not configured
 */
export const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api';

/**
 * Get Paystack public key from app.json configuration
 * Try multiple ways to access the config for compatibility
 */
export const PAYSTACK_PUBLIC_KEY = 
  Constants.expoConfig?.extra?.PAYSTACK_PUBLIC_KEY || 
  Constants.manifest?.extra?.PAYSTACK_PUBLIC_KEY ||
  Constants.manifest2?.extra?.PAYSTACK_PUBLIC_KEY ||
  null;

// Validate required configuration
if (!PAYSTACK_PUBLIC_KEY) {
  console.warn('PAYSTACK_PUBLIC_KEY is not configured. Payment functionality may not work properly.');
  console.warn('Available config:', {
    expoConfig: !!Constants.expoConfig,
    manifest: !!Constants.manifest,
    manifest2: !!Constants.manifest2,
    expoConfigExtra: Constants.expoConfig?.extra,
  });
} else {
  console.log('PAYSTACK_PUBLIC_KEY loaded successfully:', PAYSTACK_PUBLIC_KEY.substring(0, 20) + '...');
}

/**
 * Helper function to build full API endpoint URLs
 * @param {string} endpoint - The API endpoint (e.g., '/auth/login')
 * @returns {string} Full URL to the endpoint
 */
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_URL}/${cleanEndpoint}`;
};

export default API_URL;








