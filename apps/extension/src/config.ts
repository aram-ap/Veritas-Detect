/**
 * Extension Configuration
 * 
 * This file manages environment-specific URLs for the extension.
 * Change API_BASE_URL based on your deployment environment.
 */

// Determine environment
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

// API Base URLs
const DEVELOPMENT_URL = 'http://localhost:3000';
const PRODUCTION_URL = import.meta.env.VITE_API_URL || 'https://your-app.vercel.app'; // Change this!

// Export the active API URL
export const API_BASE_URL = isDevelopment ? DEVELOPMENT_URL : PRODUCTION_URL;

// API Endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH_EXTENSION_TOKEN: `${API_BASE_URL}/api/auth/extension-token`,
  AUTH_LOGIN: `${API_BASE_URL}/api/auth/login`,
  AUTH_LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  
  // Analysis endpoint
  ANALYZE: `${API_BASE_URL}/api/analyze`,
};

// Cookie configuration
export const COOKIE_CONFIG = {
  url: API_BASE_URL,
  authCookieName: 'veritas-ext-auth',
};

// Log current configuration (helpful for debugging)
console.log('[Veritas Config]', {
  environment: isDevelopment ? 'development' : 'production',
  apiBaseUrl: API_BASE_URL,
  isDevelopment,
});

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  COOKIE_CONFIG,
  isDevelopment,
};
