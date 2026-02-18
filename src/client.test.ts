import axios from 'axios';
import { SciroClient } from './client';
import { DataItem, User } from './types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SciroClient', () => {
  let client: SciroClient;
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      response: {
        use: jest.fn(),
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    client = new SciroClient({ apiKey: 'test-api-key' });
  });

  describe('constructor', () => {
    it('should throw error if API key is not provided', () => {
      expect(() => new SciroClient({ apiKey: '' })).toThrow('API key is required');
    });

    it('should create instance with default configuration', () => {
      const config = client.getConfig();
      expect(config.apiKey).toBe('test-api-key');
      expect(config.baseUrl).toBe('https://api.sciro.io');
      expect(config.timeout).toBe(30000);
    });

    it('should create instance with custom configuration', () => {
      const customClient = new SciroClient({
        apiKey: 'custom-key',
        baseUrl: 'https://custom.api.com',
        timeout: 5000,
        headers: { 'X-Custom': 'header' },
      });
      const config = customClient.getConfig();
      expect(config.baseUrl).toBe('https://custom.api.com');
      expect(config.timeout).toBe(5000);
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch current user', async () => {
      const mockUser: User = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: '2024-01-01',
      };
      mockAxiosInstance.get.mockResolvedValue({
        data: mockUser,
        status: 200,
      });

      const response = await client.getCurrentUser();
      expect(response.data).toEqual(mockUser);
      expect(response.status).toBe(200);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/user/me');
    });
  });

  describe('getUser', () => {
    it('should fetch user by ID', async () => {
      const mockUser: User = {
        id: '456',
        email: 'user@example.com',
        name: 'Another User',
        createdAt: '2024-01-01',
      };
      mockAxiosInstance.get.mockResolvedValue({
        data: mockUser,
        status: 200,
      });

      const response = await client.getUser('456');
      expect(response.data).toEqual(mockUser);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/users/456');
    });
  });

  describe('listData', () => {
    it('should list all data items', async () => {
      const mockData: DataItem[] = [
        {
          id: '1',
          name: 'Item 1',
          value: 'value1',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ];
      mockAxiosInstance.get.mockResolvedValue({
        data: mockData,
        status: 200,
      });

      const response = await client.listData();
      expect(response.data).toEqual(mockData);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/data', { params: undefined });
    });

    it('should list data items with query parameters', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [],
        status: 200,
      });

      await client.listData({ page: 1, limit: 10, sortBy: 'name', order: 'asc' });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/data', {
        params: { page: 1, limit: 10, sortBy: 'name', order: 'asc' },
      });
    });
  });

  describe('getData', () => {
    it('should fetch data item by ID', async () => {
      const mockItem: DataItem = {
        id: '1',
        name: 'Test Item',
        value: 'test value',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      mockAxiosInstance.get.mockResolvedValue({
        data: mockItem,
        status: 200,
      });

      const response = await client.getData('1');
      expect(response.data).toEqual(mockItem);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/data/1');
    });
  });

  describe('createData', () => {
    it('should create a new data item', async () => {
      const newItem = { name: 'New Item', value: 'new value' };
      const createdItem: DataItem = {
        ...newItem,
        id: '2',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      mockAxiosInstance.post.mockResolvedValue({
        data: createdItem,
        status: 201,
      });

      const response = await client.createData(newItem);
      expect(response.data).toEqual(createdItem);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/data', newItem);
    });
  });

  describe('updateData', () => {
    it('should update an existing data item', async () => {
      const updates = { name: 'Updated Name' };
      const updatedItem: DataItem = {
        id: '1',
        name: 'Updated Name',
        value: 'value',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      };
      mockAxiosInstance.put.mockResolvedValue({
        data: updatedItem,
        status: 200,
      });

      const response = await client.updateData('1', updates);
      expect(response.data).toEqual(updatedItem);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/data/1', updates);
    });
  });

  describe('deleteData', () => {
    it('should delete a data item', async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        status: 204,
      });

      const response = await client.deleteData('1');
      expect(response.status).toBe(204);
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/data/1');
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const config1 = client.getConfig();
      const config2 = client.getConfig();
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Should be a different object
    });
  });
});
