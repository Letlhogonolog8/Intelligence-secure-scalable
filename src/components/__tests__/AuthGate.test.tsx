import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { User } from "@supabase/supabase-js"
import { vi } from "vitest"
import { AuthGate } from "@/components/auth/AuthGate"
import { useAuth } from "@/hooks/use-auth"

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

describe("AuthGate", () => {
  const mockUseAuth = vi.mocked(useAuth)

  it("shows loading state while checking access", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      loading: true,
      signInWithPassword: vi.fn(),
      signUpWithPassword: vi.fn(),
      signOut: vi.fn(),
    })

    render(
      <AuthGate>
        <div>Protected</div>
      </AuthGate>
    )

    expect(screen.getByText("Checking access")).toBeInTheDocument()
  })

  it("renders children when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "agent@aegis.ai" } as User,
      session: null,
      loading: false,
      signInWithPassword: vi.fn(),
      signUpWithPassword: vi.fn(),
      signOut: vi.fn(),
    })

    render(
      <AuthGate>
        <div>Protected</div>
      </AuthGate>
    )

    expect(screen.getByText("Protected")).toBeInTheDocument()
  })

})
