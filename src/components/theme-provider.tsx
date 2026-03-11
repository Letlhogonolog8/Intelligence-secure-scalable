import type { ReactNode } from "react"
import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

type ThemeProviderProps = {
  children: ReactNode
  defaultTheme?: Theme
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("theme")
      return (savedTheme && (savedTheme === "dark" || savedTheme === "light" || savedTheme === "system")
        ? savedTheme
        : defaultTheme) as Theme
    }
    return defaultTheme as Theme
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"
      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value: ThemeContextType = {
    theme,
    setTheme: (nextTheme: Theme) => {
      localStorage.setItem("theme", nextTheme)
      setTheme(nextTheme)
    },
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
