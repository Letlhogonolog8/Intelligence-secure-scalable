import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import Sidebar from "@/components/Sidebar"

describe("Sidebar", () => {
  it("renders core module labels", () => {
    render(
      <Sidebar
        activeModule="command_center"
        collapsed={false}
        onModuleChange={() => undefined}
        onToggle={() => undefined}
      />
    )

    expect(screen.getByText("Command Center")).toBeInTheDocument()
  })
})
