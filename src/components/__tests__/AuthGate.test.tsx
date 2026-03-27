import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { User } from "@supabase/supabase-js"
import { vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { AuthGate } from "@/components/auth/AuthGate"
import { useAuth } from "@/hooks/use-auth"
import { useUserProfile } from "@/data/aegisData"

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}))

vi.mock("@/data/aegisData", () => ({
  useUserProfile: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock("@/lib/env", () => ({
  hasSupabase: true,
  env: {
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_KEY: "test-anon-key",
  },
}))

describe("AuthGate", () => {
  const mockUseAuth = vi.mocked(useAuth)
  const mockUseUserProfile = vi.mocked(useUserProfile)

  const renderAuthGate = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthGate>
            <div>Protected</div>
          </AuthGate>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }

  it("shows loading state while checking access", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: true,
      signInWithPassword: vi.fn(),
      signUpWithPassword: vi.fn(),
      signOut: vi.fn(),
    })
    mockUseUserProfile.mockReturnValue({ data: null, isLoading: false } as ReturnType<typeof useUserProfile>)

    renderAuthGate()

    expect(screen.getByText("Checking access")).toBeInTheDocument()
  })

  it("renders children when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "agent@aegis.ai" } as User,
      session: null,
      loading: false,
      signInWithPassword: vi.fn(),
      signUpWithPassword: vi.fn(),
      signOut: vi.fn(),
    })
    mockUseUserProfile.mockReturnValue(
      {
        data: {
          role: "survivor",
          approvalStatus: "approved",
          isActive: true,
        },
        isLoading: false,
      } as ReturnType<typeof useUserProfile>
    )

    renderAuthGate()

    expect(screen.getByText("Protected")).toBeInTheDocument()
  })

})
