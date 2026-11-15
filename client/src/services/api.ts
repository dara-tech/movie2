import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import apiConfig from '../config/api';
import { requestCache, createCacheKey } from '../utils/requestCache';

// Create axios instance with base configuration
const axiosInstance = axios.create(apiConfig);

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors or backend not responding
    if (error.message === 'Network Error' || !error.response) {
      // Check if it's a timeout or actual network error
      if (error.code === 'ECONNABORTED') {
      } else {
      }
      // Silent fail
      return Promise.reject(error);
    }
    
    // Handle specific HTTP status codes
    if (error.response?.status === 401) {
      // Only redirect if we're not already on login/register pages
      // and if the request is NOT to a public endpoint
      const currentPath = window.location.pathname;
      const requestUrl = error.config?.url || '';
      
      // List of public endpoints that shouldn't trigger login redirect
      const publicEndpoints = [
        '/api/movies',
        '/api/tvshows',
        '/api/genres',
        '/api/search',
        '/api/smartlinks',
        '/api/cast',
        '/api/health'
      ];
      
      const isPublicEndpoint = publicEndpoints.some(endpoint => requestUrl.includes(endpoint));
      
      if (!currentPath.includes('/login') && 
          !currentPath.includes('/register') && 
          !currentPath.includes('/public') &&
          !isPublicEndpoint) {
        // Token expired or invalid - only redirect for protected endpoints
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    
    // Silent fail
    
    return Promise.reject(error);
  }
);

// Create a wrapped API object with request caching for GET requests
const api = {
  ...axiosInstance,
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> => {
    // Skip cache if X-No-Cache header is set
    if (config?.headers?.['X-No-Cache']) {
      return axiosInstance.get<T>(url, config);
    }
    
    const cacheKey = createCacheKey(url, config?.params);
    return requestCache.get(cacheKey, () => {
      return axiosInstance.get<T>(url, config);
    });
  },
  post: axiosInstance.post.bind(axiosInstance),
  put: axiosInstance.put.bind(axiosInstance),
  patch: axiosInstance.patch.bind(axiosInstance),
  delete: axiosInstance.delete.bind(axiosInstance),
  request: axiosInstance.request.bind(axiosInstance),
  defaults: axiosInstance.defaults,
  interceptors: axiosInstance.interceptors,
};

export default api;
