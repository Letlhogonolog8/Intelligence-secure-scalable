import { describe, it, expect, beforeEach, vi } from "vitest";
import axios from "axios";
import { APIClient } from "@/lib/apiClient";

const mockAxiosInstance = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
}));

vi.mock("axios", () => {
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe("APIClient", () => {
  let apiClient: APIClient;
  let assignSpy: ReturnType<typeof vi.fn>;
  let requestInterceptor: (
    config: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign: assignSpy },
      writable: true,
      configurable: true,
    });
    apiClient = new APIClient();
    [requestInterceptor] = mockAxiosInstance.interceptors.request.use.mock
      .calls[0] as [
      (config: Record<string, unknown>) => Promise<Record<string, unknown>>,
    ];
  });

  describe("initialization", () => {
    it("should create API client with correct base URL", () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.stringContaining("/api"),
          timeout: 30000,
        }),
      );
    });

    it("should set required headers", () => {
      const createCall = (axios.create as unknown as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as Record<string, unknown>;
      expect(
        (createCall.headers as Record<string, unknown>)["Content-Type"],
      ).toBe("application/json");
      expect(
        (createCall.headers as Record<string, unknown>)["X-Client-Version"],
      ).toBeDefined();
    });

    it("should setup request and response interceptors", () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe("HTTP methods", () => {
    it("should call GET endpoint", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 1 } });

      const result = await apiClient.get("/users/1");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/users/1", undefined);
      expect(result.data).toEqual({ id: 1 });
    });

    it("should call POST endpoint with data", async () => {
      const postData = { name: "Test User" };
      mockAxiosInstance.post.mockResolvedValue({
        data: { id: 1, ...postData },
      });

      const result = await apiClient.post("/users", postData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/users",
        postData,
        undefined,
      );
      expect(result.data).toEqual({ id: 1, ...postData });
    });

    it("should call PUT endpoint with data", async () => {
      const updateData = { name: "Updated User" };
      mockAxiosInstance.put.mockResolvedValue({
        data: { id: 1, ...updateData },
      });

      const result = await apiClient.put("/users/1", updateData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        "/users/1",
        updateData,
        undefined,
      );
      expect(result.data).toEqual({ id: 1, ...updateData });
    });

    it("should call DELETE endpoint", async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: { success: true } });

      const result = await apiClient.delete("/users/1");

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/users/1",
        undefined,
      );
      expect(result.data).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("should handle 401 Unauthorized error", () => {
      const error = {
        response: {
          status: 401,
          data: { error: { message: "Unauthorized" } },
        },
        message: "Unauthorized",
      };

      const [, errorHandler] =
        mockAxiosInstance.interceptors.response.use.mock.calls[0];
      expect(() => errorHandler(error)).toThrow("Unauthorized");
      // "/auth" is the registered sign-in route; "/auth/login" does not exist
      // in the router and previously landed 401s on the 404 page.
      expect(assignSpy).toHaveBeenCalledWith("/auth");
    });

    it("should handle 429 Rate Limited error", () => {
      const error = {
        response: {
          status: 429,
          data: { error: { message: "Too Many Requests" } },
        },
        message: "Too Many Requests",
      };

      expect(() => {
        const [, errorHandler] =
          mockAxiosInstance.interceptors.response.use.mock.calls[0];
        errorHandler(error);
      }).toThrow();
    });

    it("should handle network errors", () => {
      const error = new Error("Network Error");

      expect(() => {
        const [, errorHandler] =
          mockAxiosInstance.interceptors.response.use.mock.calls[0];
        errorHandler(error);
      }).toThrow();
    });
  });

  describe("request interceptor", () => {
    it("should add authorization header if session exists", async () => {
      const mockSession = {
        access_token: "test-token-123",
      };

      const { supabase } = await import("@/lib/supabase");
      (
        supabase.auth.getSession as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ data: { session: mockSession } });

      const config: Record<string, unknown> = { headers: {} };
      await requestInterceptor(config);

      expect((config.headers as Record<string, unknown>).Authorization).toBe(
        "Bearer test-token-123",
      );
    });

    it("should not add authorization header if no session", async () => {
      const { supabase } = await import("@/lib/supabase");
      (
        supabase.auth.getSession as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValue({ data: { session: null } });

      const config: Record<string, unknown> = { headers: {} };
      await requestInterceptor(config);

      expect(
        (config.headers as Record<string, unknown>).Authorization,
      ).toBeUndefined();
    });
  });

  describe("correlation ID", () => {
    it("should include correlation ID in request headers", async () => {
      const config: Record<string, unknown> = { headers: {} };
      await requestInterceptor(config);

      expect(
        (config.headers as Record<string, unknown>)[
          "X-Correlation-ID"
        ] as string,
      ).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("should generate a fresh correlation ID for each request", async () => {
      const firstConfig: Record<string, unknown> = { headers: {} };
      const secondConfig: Record<string, unknown> = { headers: {} };

      await requestInterceptor(firstConfig);
      await requestInterceptor(secondConfig);

      expect(
        (firstConfig.headers as Record<string, unknown>)["X-Correlation-ID"],
      ).toBeDefined();
      expect(
        (secondConfig.headers as Record<string, unknown>)["X-Correlation-ID"],
      ).toBeDefined();
      expect(
        (firstConfig.headers as Record<string, unknown>)["X-Correlation-ID"],
      ).not.toBe(
        (secondConfig.headers as Record<string, unknown>)["X-Correlation-ID"],
      );
    });
  });

  describe("timeout configuration", () => {
    it("should set reasonable timeout", () => {
      const createCall = (axios.create as unknown as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as Record<string, unknown>;
      expect(createCall.timeout).toBe(30000);
    });
  });

  describe("concurrent requests", () => {
    it("should handle multiple concurrent requests", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 1 } });
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 2 } });

      const [result1, result2] = await Promise.all([
        apiClient.get("/users/1"),
        apiClient.post("/users", { name: "New User" }),
      ]);

      expect(result1.data).toEqual({ id: 1 });
      expect(result2.data).toEqual({ id: 2 });
      expect(mockAxiosInstance.get).toHaveBeenCalled();
      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });
  });
});
