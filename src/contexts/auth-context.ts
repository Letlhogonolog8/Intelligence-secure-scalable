import * as React from "react"
import { Session, User } from "@supabase/supabase-js"

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null; user: User | null }>
  signUpWithPassword: (email: string, password: string) => Promise<{ error: Error | null; session: Session | null; user: User | null }>
  signOut: () => Promise<void>
}

export const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)
