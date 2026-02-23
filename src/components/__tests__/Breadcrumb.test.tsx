import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { Breadcrumb } from "@/components/Breadcrumb"

describe("Breadcrumb", () => {
  it("renders home link and current module", () => {
    render(<Breadcrumb currentModule="command_center" />)

    expect(screen.getByText("AEGIS")).toBeInTheDocument()
    expect(screen.getByText("Command Center")).toBeInTheDocument()
  })

  it("renders current page when provided", () => {
    render(<Breadcrumb currentModule="justice" currentPage="Case Details" />)

    expect(screen.getByText("Justice Analytics")).toBeInTheDocument()
    expect(screen.getByText("Case Details")).toBeInTheDocument()
  })

  it("renders correctly for different modules", () => {
    const { rerender } = render(<Breadcrumb currentModule="survivor_support" />)

    expect(screen.getByText("Survivor Support")).toBeInTheDocument()

    rerender(<Breadcrumb currentModule="prediction" />)

    expect(screen.getByText("Risk Prediction")).toBeInTheDocument()
  })
})
