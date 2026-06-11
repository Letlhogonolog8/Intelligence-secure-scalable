import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { buildAuthEmail } from "@/auth/buildAuthEmail";
import { registerPushToken, resetPushRegistration } from "@/features/push/registerPush";
import type { UserProfileRow } from "@/shared/types";

export class NotSurvivorError extends Error {
  constructor() {
    super("not_survivor");
    this.name = "NotSurvivorError";
  }
}

interface AuthState {
  initializing: boolean;
  session: Session | null;
  user: User | null;
  profile: UserProfileRow | null;
  isSurvivor: boolean;
  signIn: (username: string, passphrase: string) => Promise<void>;
  signUp: (username: string, passphrase: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function fetchProfile(userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as UserProfileRow | null) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const mounted = useRef(true);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const p = await fetchProfile(userId);
      if (mounted.current) setProfile(p);
    } catch {
      if (mounted.current) setProfile(null);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      // getSession reads the local AsyncStorage session and is normally instant,
      // but guard it so a slow token refresh can never hang the launch gate.
      const withTimeout = Promise.race([
        supabase.auth.getSession(),
        new Promise<{ data: { session: Session | null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 4000),
        ),
      ]);
      const { data } = await withTimeout;
      if (!mounted.current) return;
      setSession(data.session);
      // Release the gate immediately; load the profile in the background so a
      // slow network never keeps the survivor staring at a splash.
      setInitializing(false);
      void loadProfile(data.session?.user?.id);
      void registerPushToken(data.session?.user?.id);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void loadProfile(next?.user?.id);
      void registerPushToken(next?.user?.id);
    });

    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (username: string, passphrase: string) => {
    const email = buildAuthEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: passphrase });
    if (error || !data.user) throw error ?? new Error("sign_in_failed");

    const p = await fetchProfile(data.user.id);
    if (p && p.role !== "survivor") {
      await supabase.auth.signOut();
      throw new NotSurvivorError();
    }
    setProfile(p);
  }, []);

  const signUp = useCallback(
    async (username: string, passphrase: string, displayName: string) => {
      const email = buildAuthEmail(username);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: passphrase,
        options: { data: { full_name: displayName, role: "survivor" } },
      });
      if (error) throw error;

      // If sign-up returned a session (email confirmation disabled for synthetic
      // emails), provision the survivor profile via the idempotent edge function.
      if (data.session) {
        await supabase.functions.invoke("ensure_user_profile", { body: {} }).catch(() => {});
        await loadProfile(data.session.user.id);
      }
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    resetPushRegistration();
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user?.id);
  }, [loadProfile, session?.user?.id]);

  const value = useMemo<AuthState>(
    () => ({
      initializing,
      session,
      user: session?.user ?? null,
      profile,
      isSurvivor: profile?.role === "survivor",
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [initializing, session, profile, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
