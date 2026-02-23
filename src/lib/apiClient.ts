/**
 * Frontend API Client
 * src/lib/apiClient.ts
 *
 * Axios-based HTTP client for communicating with the API gateway.
 * Handles authentication, request/response interceptors, and error handling.
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { getSession } from '@supabase/auth-helpers-js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const CORRELATION_ID = crypto.randomUUID();

interface APIError {
  message: string;
  status: number;
  correlationId?: string;
  timestamp: string;
}

interface APIResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': CORRELATION_ID,
        'X-Client-Version': import.meta.env.VITE_DATADOG_VERSION || '1.0.0',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor: Add auth token
    this.client.interceptors.request.use(async (config) => {
      try {
        const { data } = await getSession();
        if (data?.session?.access_token) {
          config.headers.Authorization = `Bearer ${data.session.access_token}`;
        }
      } catch (error) {
        console.debug('No active session');
      }
      return config;
    });

    // Response interceptor: Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<{ error: APIError }>) => {
        this.handleError(error);
        throw error;
      }
    );
  }

  private handleError(error: AxiosError<{ error: APIError }>): void {
    const status = error.response?.status;
    const message = error.response?.data?.error?.message || error.message;

    // Handle specific status codes
    if (status === 401) {
      // Unauthorized - redirect to login
      window.location.href = '/auth/login';
    } else if (status === 403) {
      // Forbidden - insufficient permissions
      console.error('Access denied:', message);
    } else if (status === 429) {
      // Too many requests - rate limited
      console.warn('Rate limit exceeded');
    } else if (status && status >= 500) {
      // Server error
      console.error('Server error:', message);
    }
  }

  // Generic request methods
  async get<T>(
    url: string,
    config?: { params?: Record<string, unknown>; [key: string]: unknown }
  ): Promise<APIResponse<T>> {
    const response = await this.client.get<T>(url, config);
    return {
      data: response.data,
      status: response.status,
      headers: response.headers as Record<string, string>,
    };
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: Record<string, unknown>
  ): Promise<APIResponse<T>> {
    const response = await this.client.post<T>(url, data, config);
    return {
      data: response.data,
      status: response.status,
      headers: response.headers as Record<string, string>,
    };
  }

  async put<T>(
    url: string,
    data?: unknown,
    config?: Record<string, unknown>
  ): Promise<APIResponse<T>> {
    const response = await this.client.put<T>(url, data, config);
    return {
      data: response.data,
      status: response.status,
      headers: response.headers as Record<string, string>,
    };
  }

  async patch<T>(
    url: string,
    data?: unknown,
    config?: Record<string, unknown>
  ): Promise<APIResponse<T>> {
    const response = await this.client.patch<T>(url, data, config);
    return {
      data: response.data,
      status: response.status,
      headers: response.headers as Record<string, string>,
    };
  }

  async delete<T>(
    url: string,
    config?: Record<string, unknown>
  ): Promise<APIResponse<T>> {
    const response = await this.client.delete<T>(url, config);
    return {
      data: response.data,
      status: response.status,
      headers: response.headers as Record<string, string>,
    };
  }
}

export const apiClient = new APIClient();
export type { APIError, APIResponse };
