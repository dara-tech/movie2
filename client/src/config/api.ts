// API Configuration
import environment from './environment';

export const apiConfig = {
  baseURL: environment.API_URL,
  timeout: 30000, // Increased timeout to 30 seconds for slower endpoints
  headers: {
    'Content-Type': 'application/json',
  },
};

export default apiConfig;
