import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { logError } from "@/lib/logger"

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}))

const ProblemChild = () => {
  throw new Error("Boom")
}

describe("ErrorBoundary", () => {
  it("renders fallback UI on error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    )

    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(screen.getByText("Boom")).toBeInTheDocument()
    expect(logError).toHaveBeenCalled()

    consoleError.mockRestore()
  })
})
