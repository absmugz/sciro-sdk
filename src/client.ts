import axios, { AxiosInstance, AxiosError } from 'axios';
import { SciroConfig, SciroResponse, SciroError, User, DataItem, ListParams } from './types';

/**
 * Main Sciro SDK Client
 */
export class SciroClient {
  private config: Required<SciroConfig>;
  private httpClient: AxiosInstance;

  /**
   * Creates a new instance of the Sciro SDK client
   * @param config - Configuration options for the client
   */
  constructor(config: SciroConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.sciro.io',
      timeout: config.timeout || 30000,
      headers: config.headers || {},
    };

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
      },
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Handle API errors
   */
  private handleError(error: AxiosError): SciroError {
    if (error.response) {
      const data = error.response.data as any;
      return {
        message: data?.message || error.message,
        code: data?.code,
        status: error.response.status,
      };
    } else if (error.request) {
      return {
        message: 'No response received from server',
        code: 'NETWORK_ERROR',
      };
    } else {
      return {
        message: error.message,
        code: 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<SciroResponse<User>> {
    const response = await this.httpClient.get<User>('/user/me');
    return {
      data: response.data,
      status: response.status,
    };
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<SciroResponse<User>> {
    const response = await this.httpClient.get<User>(`/users/${userId}`);
    return {
      data: response.data,
      status: response.status,
    };
  }

  /**
   * List all data items
   */
  async listData(params?: ListParams): Promise<SciroResponse<DataItem[]>> {
    const response = await this.httpClient.get<DataItem[]>('/data', {
      params,
    });
    return {
      data: response.data,
      status: response.status,
    };
  }

  /**
   * Get a specific data item by ID
   */
  async getData(itemId: string): Promise<SciroResponse<DataItem>> {
    const response = await this.httpClient.get<DataItem>(`/data/${itemId}`);
    return {
      data: response.data,
      status: response.status,
    };
  }

  /**
   * Create a new data item
   */
  async createData(data: Omit<DataItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<SciroResponse<DataItem>> {
    const response = await this.httpClient.post<DataItem>('/data', data);
    return {
      data: response.data,
      status: response.status,
    };
  }

  /**
   * Update an existing data item
   */
  async updateData(itemId: string, data: Partial<DataItem>): Promise<SciroResponse<DataItem>> {
    const response = await this.httpClient.put<DataItem>(`/data/${itemId}`, data);
    return {
      data: response.data,
      status: response.status,
    };
  }

  /**
   * Delete a data item
   */
  async deleteData(itemId: string): Promise<SciroResponse<void>> {
    const response = await this.httpClient.delete(`/data/${itemId}`);
    return {
      data: undefined!,
      status: response.status,
    };
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<Required<SciroConfig>> {
    return { ...this.config };
  }
}
