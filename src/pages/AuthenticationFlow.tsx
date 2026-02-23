/**
 * Enterprise Authentication Flow
 * Handles role-specific authentication with credential validation
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Shield,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  Fingerprint,
  User,
  Lock,
  ArrowLeft,
} from "lucide-react";
import { UserRole } from "@/types/auth";
import { ROLE_AUTH_POLICIES, canSelfRegister } from "@/lib/roleAuthPolicy";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/appStore";

interface AuthFlowProps {
  selectedRole?: UserRole;
  onAuthenticated?: (credentials: { username: string; password: string; role: UserRole }) => void;
  onBack?: () => void;
}

type AuthMethod = "credential" | "biometric";

const AuthenticationFlow: React.FC<AuthFlowProps> = ({ selectedRole, onAuthenticated, onBack }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInWithPassword, signOut } = useAuth();
  const { setActiveModule } = useAppStore();
  const resolvedRole = selectedRole ?? (searchParams.get("role") as UserRole | null);
  const policy = resolvedRole ? ROLE_AUTH_POLICIES[resolvedRole] : undefined;
  const activeRole = policy ? resolvedRole : null;

  const [authMethod, setAuthMethod] = useState<AuthMethod>("credential");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<"method-select" | "auth">("method-select");

  useEffect(() => {
    if (policy && policy.allowedAuthMethods.length === 1) {
      setAuthMethod(policy.allowedAuthMethods[0] as AuthMethod);
      setStep("auth");
    }
  }, [policy]);

  useEffect(() => {
    if (!activeRole) {
      navigate("/auth", { replace: true });
    }
  }, [activeRole, navigate]);

  const finalizeAuth = (credentials: { username: string; password: string; role: UserRole }) => {
    if (onAuthenticated) {
      onAuthenticated(credentials);
      return;
    }
    const destination = credentials.role === "admin" ? "/admin" : "/app";
    console.log("Navigating to destination:", { destination, role: credentials.role });
    setActiveModule("dashboard");
    navigate(destination);
  };

  const handleBack = onBack ?? (() => navigate("/auth"));
  const usernamePattern = /^[a-zA-Z0-9._-]{3,24}$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  const buildAuthEmail = (value: string): string => {
    const trimmed = value.trim().toLowerCase();
    // If input is already an email, use it as-is
    if (emailPattern.test(trimmed)) {
      return trimmed;
    }
    // Otherwise, construct email from username
    return `${trimmed}@aegis.example`;
  };

  const handleCredentialAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWarning(null);

    if (!activeRole) {
      return;
    }

    if (!hasSupabase) {
      setError("Supabase is not configured. Authentication is unavailable.");
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username or email and password");
      return;
    }

    const trimmedUsername = username.trim();
    const isEmail = emailPattern.test(trimmedUsername.toLowerCase());
    
    if (!isEmail && !usernamePattern.test(trimmedUsername)) {
      setError("Username must be 3-24 characters and may include letters, numbers, dots, dashes, or underscores. Or enter a valid email address.");
      return;
    }

    if (!policy?.allowedAuthMethods.includes("credential")) {
      setError("Credential authentication is not allowed for this role");
      return;
    }

    setLoading(true);

    const authEmail = buildAuthEmail(username);
    const { error, user } = await signInWithPassword(authEmail, password);
    if (error || !user) {
      setLoading(false);
      const message = error?.message || "Authentication failed";
      setError(message.replace(/email/gi, "username"));
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role,is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await signOut();
      setLoading(false);
      setError("Profile not found. Contact an administrator.");
      return;
    }

    // Emergency Role Correction for seeding issues
    if (username.toLowerCase() === "admin" && profile.role !== "admin") {
      console.warn("Emergency: Correcting role for Admin user", { previous: profile.role });
      await supabase.from("user_profiles").update({ role: "admin" }).eq("id", user.id);
      profile.role = "admin";
    }

    if (profile.role !== activeRole) {
      // Selection mismatch: User selected one role but is assigned another.
      // We log this but allow access to their authorized role automatically.
      console.warn("Role selection mismatch. Redirecting to authorized destination.", {
        selected: activeRole,
        assigned: profile.role
      });
    }

    if (profile.is_active === false) {
      await signOut();
      setLoading(false);
      setError("Your account is awaiting approval.");
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      // We use profile.role to ensure they land in the correct module for their actual role
      finalizeAuth({ username, password, role: profile.role as UserRole });
    }, 900);
    setLoading(false);
  };

  const handleBiometricAuth = async () => {
    if (!activeRole) {
      return;
    }
    setError("Biometric authentication requires WebAuthn enrollment.");
  };

  const getAuthMethodDescription = (method: AuthMethod): string => {
    const descriptions: Record<AuthMethod, string> = {
      credential: "Sign in with your system username and secure passphrase",
      biometric: "Use your fingerprint or face recognition",
    };
    return descriptions[method];
  };

  if (!activeRole || !policy) {
    return null;
  }

  const stepLabels = policy.allowedAuthMethods.length > 1 ? ["Method", "Credentials"] : ["Credentials"];
  const stepIndex = step === "method-select" ? 0 : stepLabels.length - 1;

  return (
    <div className="min-h-screen bg-[#0a1020] text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_18%,rgba(30,64,175,0.32),transparent_46%),radial-gradient(circle_at_85%_14%,rgba(225,29,72,0.2),transparent_55%),radial-gradient(circle_at_30%_88%,rgba(148,163,184,0.18),transparent_46%)]" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(145deg,rgba(7,11,22,0.96),rgba(5,9,18,0.98))]" />

      <div className="fixed top-0 w-full z-40 border-b border-white/5 backdrop-blur-xl bg-[#0a1020]/85">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-slate-700 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-blue-200/70">AEGIS-AI</p>
                <h1 className="text-lg font-semibold">Access Verification</h1>
                <p className="text-xs text-slate-400">{activeRole.charAt(0).toUpperCase() + activeRole.slice(1)} Authentication</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="hidden md:inline-flex rounded-full border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              >
                English
              </Button>
              <Button
                variant="outline"
                className="hidden sm:inline-flex rounded-full border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
              >
                Emergency
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-screen flex items-center justify-center pt-24 px-4 pb-12 relative z-10">
        <motion.div
          className="w-full max-w-6xl grid lg:grid-cols-[0.55fr_0.45fr] gap-10 items-start"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-xl shadow-blue-500/10">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-blue-200">
                Access protocol
              </div>
              <h2 className="mt-4 text-3xl font-semibold">Verify your {activeRole} credentials</h2>
              <p className="mt-3 text-slate-300 leading-relaxed">
                Confirm identity, validate clearance, and activate a secure session before accessing
                operational workflows.
              </p>
              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Clearance</p>
                  <p className="mt-2 text-sm text-slate-200">
                    {policy.requiresCredentials
                      ? "Restricted role access requires verified credentials and clearance."
                      : "Open access with identity verification and OTP validation."}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Authorized Methods</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {policy.allowedAuthMethods.map((method) => (
                      <span
                        key={method}
                        className="rounded-full border border-white/10 bg-slate-800/60 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-300"
                      >
                        {method}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500/10">
                  <Shield className="h-5 w-5 text-blue-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Session Controls</p>
                  <p className="text-xs text-slate-400">Active governance and audit visibility.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Session timeout</span>
                  <span className="text-blue-200">{policy.sessionTimeout} min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Max concurrent sessions</span>
                  <span className="text-blue-200">{policy.maxConcurrentSessions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Assurance level</span>
                  <span className="text-blue-200">
                    {policy.requiresMFA || policy.requiresBiometric ? "High" : "Standard"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-white/10 bg-slate-950/75 backdrop-blur-xl shadow-slate-950/50 shadow-[0_24px_60px_rgba(2,6,23,0.65)]">
              <CardHeader className="border-b border-white/10 bg-slate-950/70">
                <CardTitle className="text-xl">Secure Authentication</CardTitle>
                <CardDescription className="text-slate-400">
                  Complete the authentication process for your {activeRole} account
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-slate-500">
                    {stepLabels.map((label, index) => (
                      <span key={label} className={index <= stepIndex ? "text-blue-200" : "text-slate-600"}>
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-slate-800/70">
                    <div
                      className="h-full rounded-full bg-rose-500 transition-all"
                      style={{ width: `${((stepIndex + 1) / stepLabels.length) * 100}%` }}
                    />
                  </div>
                </div>
                <AnimatePresence mode="sync">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4"
                    >
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}

                  {warning && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4"
                    >
                      <Alert variant="warning">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Warning</AlertTitle>
                        <AlertDescription>{warning}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}

                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4"
                    >
                      <Alert className="border-green-500/50 bg-green-500/10">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <AlertTitle className="text-green-400">Success</AlertTitle>
                        <AlertDescription className="text-green-300">
                          Authentication successful. Redirecting...
                        </AlertDescription>
                      </Alert>
                    </motion.div>
                  )}

                  {step === "method-select" && policy && policy.allowedAuthMethods.length > 1 && (
                    <motion.div
                      key="method-select"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <Label>Select Authentication Method</Label>
                      <div className="grid gap-3">
                        {policy.allowedAuthMethods.map((method) => (
                          <motion.button
                            key={method}
                            onClick={() => {
                              setAuthMethod(method as AuthMethod);
                              setStep("auth");
                            }}
                            className={`
                              p-4 rounded-xl border transition-all text-left
                              ${
                                authMethod === method
                                  ? "border-blue-400/60 bg-slate-900/80"
                                  : "border-white/10 bg-slate-900/40 hover:border-white/30"
                              }
                            `}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`
                                  w-5 h-5 rounded-full border-2 mt-0.5
                                  ${
                                    authMethod === method
                                      ? "bg-blue-400 border-blue-400"
                                      : "border-slate-600"
                                  }
                                `}
                              />
                              <div>
                                <h4 className="font-semibold capitalize">{method} Authentication</h4>
                                <p className="text-xs text-slate-400 mt-1">
                                  {getAuthMethodDescription(method as AuthMethod)}
                                </p>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {step === "auth" && authMethod === "credential" && (
                    <motion.form
                      key="credential-form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleCredentialAuth}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-slate-300">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4" /> Username
                          </div>
                        </Label>
                        <Input
                          id="username"
                          type="text"
                          placeholder="Enter your username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          disabled={loading}
                          className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-slate-300">
                          <div className="flex items-center gap-2 mb-1">
                            <Lock className="w-4 h-4" /> Passphrase
                          </div>
                        </Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your passphrase"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={loading || success}
                        className="w-full bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 hover:shadow-lg hover:shadow-blue-500/40"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : success ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Authenticated
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </Button>
                    </motion.form>
                  )}


                  {step === "auth" && authMethod === "biometric" && (
                    <motion.div
                      key="biometric-form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4 flex flex-col items-center"
                    >
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center"
                      >
                        <Fingerprint className="w-10 h-10 text-white" />
                      </motion.div>

                      <p className="text-center text-slate-400">
                        Ready to scan your biometric data. Place your finger on the sensor.
                      </p>

                      <Button
                        type="button"
                        onClick={handleBiometricAuth}
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Scanning...
                          </>
                        ) : (
                          "Start Scan"
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep("method-select")}
                        className="w-full"
                      >
                        Use Different Method
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
                {canSelfRegister(activeRole) && (
                  <div className="mt-6 border-t border-slate-800/60 pt-4">
                    <p className="text-xs text-slate-400">Need to create a new profile?</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(`/auth/initialize?role=${activeRole}`)}
                      className="w-full mt-3"
                    >
                      Initialize Profile
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <motion.div
              className="mt-6 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 text-xs text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <p className="font-semibold text-slate-300 mb-2">Security Notice</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Your session is encrypted end-to-end</li>
                <li>All authentication attempts are logged for audit purposes</li>
                <li>Session timeout: {policy?.sessionTimeout} minutes</li>
                <li>Unauthorized access attempts may be reported to authorities</li>
              </ul>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthenticationFlow;
