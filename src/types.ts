/**
 * Configuration options for the Sciro SDK client
 */
export interface SciroConfig {
  /**
   * API key for authentication
   */
  apiKey: string;
  
  /**
   * Base URL for the Sciro API
   * @default 'https://api.sciro.io'
   */
  baseUrl?: string;
  
  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
  
  /**
   * Custom headers to include in all requests
   */
  headers?: Record<string, string>;
}

/**
 * Response wrapper for API calls
 */
export interface SciroResponse<T> {
  data: T;
  status: number;
  message?: string;
}

/**
 * Error response from the API
 */
export interface SciroError {
  message: string;
  code?: string;
  status?: number;
}

/**
 * User data structure
 */
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

/**
 * Data item structure
 */
export interface DataItem {
  id: string;
  name: string;
  value: any;
  createdAt: string;
  updatedAt: string;
}

/**
 * Query parameters for listing resources
 */
export interface ListParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}
