import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { vi } from "vitest"
import SurvivorSupport from "@/components/survivor/SurvivorSupport"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}))

describe("SurvivorSupport", () => {
  const invoke = vi.mocked(supabase.functions.invoke)

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  beforeEach(() => {
    invoke.mockReset()
  })

  it("sends a message and renders the assistant response", async () => {
    invoke.mockResolvedValue({
      data: {
        response: {
          message: "I am here to help.",
          risk_level: "low",
          risk_score: 0.2,
          emotion_detected: "neutral",
          suggested_actions: [],
          resources: [],
          safety_alert: false,
        },
      },
      error: null,
    })

    render(<SurvivorSupport />)

    const input = screen.getByPlaceholderText(/type your message/i)
    fireEvent.change(input, { target: { value: "Hello" } })
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" })

    await waitFor(() => expect(invoke).toHaveBeenCalled())
    expect(screen.getByText("I am here to help.")).toBeInTheDocument()
  })

  it("shows a fallback message when the chat service fails", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("Service unavailable") })

    render(<SurvivorSupport />)

    const input = screen.getByPlaceholderText(/type your message/i)
    fireEvent.change(input, { target: { value: "Help" } })
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" })

    await waitFor(() => expect(invoke).toHaveBeenCalled())
    expect(
      screen.getByText(/i'm experiencing a brief connection issue/i)
    ).toBeInTheDocument()
  })
})
