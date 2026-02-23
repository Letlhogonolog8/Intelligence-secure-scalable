import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { logError } from "@/lib/logger"

const isDev = import.meta.env.DEV

type ErrorBoundaryProps = {
  children: React.ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    logError(error, { source: "ErrorBoundary" })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <Card className="max-w-lg w-full bg-slate-900/70 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Something went wrong</CardTitle>
              <CardDescription className="text-slate-400">
                We logged the issue and are working on a fix.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 break-words">
                {isDev ? this.state.error?.message ?? "Unexpected error" : "Unexpected error"}
              </p>
            </CardContent>
            <CardFooter className="justify-end">
              <Button onClick={this.handleReload}>Reload</Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
