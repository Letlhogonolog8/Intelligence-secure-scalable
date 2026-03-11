import React, { useEffect, useMemo, useState } from "react"
import { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { logError } from "@/lib/logger"
import { AuthContext } from "@/contexts/auth-context"
import { hasSupabase } from "@/lib/env"

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const isInvalidRefreshTokenError = (error: unknown) => {
    if (!error) {
      return false
    }
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error)
    return /invalid refresh token|refresh token not found/i.test(message)
  }

  useEffect(() => {
    if (!hasSupabase) {
      setLoading(false)
      return
    }
    let mounted = true
    const loadSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        logError(error, { source: "auth.getSession" })
        if (isInvalidRefreshTokenError(error)) {
          await supabase.auth.signOut()
        }
      }
      if (!mounted) {
        return
      }
      if (error && isInvalidRefreshTokenError(error)) {
        setSession(null)
        setUser(null)
        setLoading(false)
        return
      }
      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
      setLoading(false)
    }
    loadSession()
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })
    return () => {
      mounted = false
      data?.subscription?.unsubscribe()
    }
  }, [])



  const signInWithPassword = async (email: string, password: string) => {
    if (!hasSupabase) {
      return { error: new Error("Supabase is not configured"), session: null, user: null }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const message = error.message.toLowerCase()
      const isExpectedCredentialError = message.includes("invalid login credentials")
      if (!isExpectedCredentialError) {
        logError(error, { source: "auth.signInWithPassword" })
      }
      return { error, session: null, user: null }
    }
    return { error: null, session: data.session ?? null, user: data.user ?? null }
  }

  const signUpWithPassword = async (email: string, password: string) => {
    if (!hasSupabase) {
      return { error: new Error("Supabase is not configured"), session: null, user: null }
    }
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      logError(error, { source: "auth.signUp" })
      return { error, session: null, user: null }
    }
    return { error: null, session: data.session ?? null, user: data.user ?? null }
  }

  const signOut = async () => {
    if (!hasSupabase) {
      return
    }
    const { error } = await supabase.auth.signOut()
    if (error) {
      logError(error, { source: "auth.signOut" })
    }
  }

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    }),
    [session, user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
