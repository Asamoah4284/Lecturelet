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





