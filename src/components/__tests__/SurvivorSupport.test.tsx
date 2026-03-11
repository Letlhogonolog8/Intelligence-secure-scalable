import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { vi } from "vitest"
import SurvivorSupport from "@/components/survivor/SurvivorSupport"
import { supabase } from "@/lib/supabase"

vi.mock("@/lib/env", () => ({
  env: {
    VITE_SUPABASE_URL: "https://test.supabase.co",
    VITE_SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWYiOiJ0ZXN0In0.123", // mock JWT with ref='test'
    VITE_ENV: "development",
  }
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      resolvedLanguage: "en",
      language: "en",
    },
  }),
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "header.payload.signature" } }, error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}))

describe("SurvivorSupport", () => {
  const invoke = vi.mocked(supabase.functions.invoke)
  const refreshSession = vi.mocked(supabase.auth.refreshSession)
  const getSession = vi.mocked(supabase.auth.getSession)

  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  beforeEach(() => {
    invoke.mockReset()
    getSession.mockReset()
    refreshSession.mockReset()
    getSession.mockResolvedValue({ data: { session: { access_token: "header.payload.signature" } }, error: null })
    refreshSession.mockResolvedValue({ data: { session: null }, error: null })
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

  it("retries after a 401 and succeeds with refreshed token", async () => {
    const response = new Response('{"code":401,"message":"Invalid JWT"}', {
      status: 401,
      statusText: "Unauthorized",
    })

    getSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "header.payload.signature",
        },
      },
      error: null,
    })

    refreshSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "next.payload.signature",
        },
      },
      error: null,
    })

    invoke
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "Edge Function execution failed",
          context: response,
        } as unknown as Error,
      })
      .mockResolvedValueOnce({
        data: {
          response: {
            message: "Session restored.",
            risk_level: "low",
            risk_score: 0.1,
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
    fireEvent.change(input, { target: { value: "Help me" } })
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" })

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2))
    expect(screen.getByText("Session restored.")).toBeInTheDocument()
  })

  it("shows sign-in prompt when session cannot be refreshed after 401", async () => {
    const response = new Response('{"code":401,"message":"Invalid JWT"}', {
      status: 401,
      statusText: "Unauthorized",
    })

    getSession.mockResolvedValueOnce({
      data: {
        session: {
          access_token: "header.payload.signature",
        },
      },
      error: null,
    })

    refreshSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Edge Function execution failed",
        context: response,
      } as unknown as Error,
    })

    render(<SurvivorSupport />)

    const input = screen.getByPlaceholderText(/type your message/i)
    fireEvent.change(input, { target: { value: "Help me" } })
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" })

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1))
    expect(
      screen.getByText(/your secure chat session expired\. please sign in again/i),
    ).toBeInTheDocument()
  })
})
