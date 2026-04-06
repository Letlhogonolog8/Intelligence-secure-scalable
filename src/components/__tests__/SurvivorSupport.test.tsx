import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { Session, User } from "@supabase/supabase-js"
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
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}))

const createMockUser = (): User =>
  ({
    id: "user-1",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  }) as User

const createMockSession = (accessToken: string): Session =>
  ({
    access_token: accessToken,
    refresh_token: "refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user: createMockUser(),
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }) as Session

type GetSessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>
type RefreshSessionResult = Awaited<ReturnType<typeof supabase.auth.refreshSession>>

const createGetSessionResponse = (accessToken: string): GetSessionResult => ({
  data: {
    session: createMockSession(accessToken),
  },
  error: null,
})

const createRefreshSessionResponse = (accessToken: string | null): RefreshSessionResult =>
  accessToken
    ? ({
        data: {
          user: createMockSession(accessToken).user,
          session: createMockSession(accessToken),
        },
        error: null,
      } as RefreshSessionResult)
    : ({
        data: { user: null, session: null },
        error: null,
      } as RefreshSessionResult)

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
    getSession.mockResolvedValue(createGetSessionResponse("header.payload.signature"))
    refreshSession.mockResolvedValue(createRefreshSessionResponse(null))
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

    getSession.mockResolvedValueOnce(createGetSessionResponse("header.payload.signature"))

    refreshSession.mockResolvedValueOnce(createRefreshSessionResponse("next.payload.signature"))

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

    getSession.mockResolvedValueOnce(createGetSessionResponse("header.payload.signature"))

    refreshSession.mockResolvedValueOnce(createRefreshSessionResponse(null))

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
