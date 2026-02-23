import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, waitFor } from "@testing-library/react"
import { vi } from "vitest"

const channelHandlers: Array<() => void> = []

vi.mock("@/lib/env", () => ({
  hasSupabase: true,
}))

vi.mock("@/lib/supabase", () => {
  const channel = vi.fn(() => {
    const api = {
      on: (_event: string, _filter: unknown, handler: () => void) => {
        channelHandlers.push(handler)
        return api
      },
      subscribe: () => api,
    }
    return api
  })

  return {
    supabase: {
      from: () => ({
        select: async () => ({ data: [], error: null }),
      }),
      channel,
      removeChannel: vi.fn(),
    },
  }
})

import { useRegions } from "@/data/aegisData"

const TestComponent = () => {
  useRegions()
  return <div>test</div>
}

describe("aegisData realtime hooks", () => {
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
})
