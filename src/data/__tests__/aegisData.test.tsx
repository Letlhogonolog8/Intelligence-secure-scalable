import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, waitFor } from "@testing-library/react"
import { vi } from "vitest"

const { channelHandlers, statusHandlers, removeChannelSpy } = vi.hoisted(() => ({
  channelHandlers: [] as Array<() => void>,
  statusHandlers: [] as Array<(status: string) => void>,
  removeChannelSpy: vi.fn(),
}))

vi.mock("@/lib/env", () => ({
  hasSupabase: true,
  env: {
    VITE_LOG_SAMPLE_RATE: 1,
    VITE_SUPABASE_URL: "http://localhost",
    VITE_SUPABASE_ANON_KEY: "test-key",
  },
}))

vi.mock("@/lib/supabase", () => {
  const channel = vi.fn(() => {
    const api = {
      on: (_event: string, _filter: unknown, handler: () => void) => {
        channelHandlers.push(handler)
        return api
      },
      subscribe: (handler?: (status: string) => void) => {
        if (handler) {
          statusHandlers.push(handler)
        }
        return api
      },
    }
    return api
  })

  return {
    supabase: {
      from: () => ({
        select: async () => ({ data: [], error: null }),
      }),
      channel,
      removeChannel: removeChannelSpy,
    },
  }
})

import { useRegions } from "@/data/aegisData"

const TestComponent = () => {
  useRegions()
  return <div>test</div>
}

describe("aegisData realtime hooks", () => {
  beforeEach(() => {
    channelHandlers.length = 0
    statusHandlers.length = 0
    removeChannelSpy.mockClear()
  })

  it("invalidates queries when realtime updates arrive", async () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    render(
      <QueryClientProvider client={queryClient}>
        <TestComponent />
      </QueryClientProvider>
    )

    await waitFor(() => expect(channelHandlers.length).toBeGreaterThan(0))

    channelHandlers.forEach((handler) => handler())

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["aegis", "regions"] })
    )
  })

  it("does not treat CLOSED status as transport failure", async () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    render(
      <QueryClientProvider client={queryClient}>
        <TestComponent />
      </QueryClientProvider>
    )

    await waitFor(() => expect(statusHandlers.length).toBeGreaterThan(0))

    statusHandlers.forEach((handler) => handler("CLOSED"))

    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["aegis", "regions"] })
    expect(removeChannelSpy).not.toHaveBeenCalled()
  })

  it("handles CHANNEL_ERROR by invalidating and removing the affected channel", async () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    render(
      <QueryClientProvider client={queryClient}>
        <TestComponent />
      </QueryClientProvider>
    )

    await waitFor(() => expect(statusHandlers.length).toBeGreaterThan(0))

    statusHandlers.forEach((handler) => handler("CHANNEL_ERROR"))

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["aegis", "regions"] })
    )
    expect(removeChannelSpy).toHaveBeenCalled()
  })
})
