/**
 * Enterprise Authentication Flow
 * Handles role-specific authentication with credential validation
 */

import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle,
  Clock3,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import { UserRole } from "@/types/auth";
import { ROLE_AUTH_POLICIES, canSelfRegister, requiresMfaForRole } from "@/lib/roleAuthPolicy";
import {
  challengeAndVerifyTotp,
  enrollTotpFactor,
  fetchAccessProfile,
  fetchMfaAssurance,
  listMfaFactors,
  unenrollMfaFactor,
  updateOwnMfaEnabled,
  verifyMfaFactor,
  type TotpEnrollment,
} from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";
import { useAuth } from "@/hooks/use-auth";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";
import AuthTopBar from "@/components/auth/AuthTopBar";
import AuthSplitLayout from "@/components/auth/AuthSplitLayout";
import AuthContextIntro from "@/components/auth/AuthContextIntro";
import AuthInfoPanel from "@/components/auth/AuthInfoPanel";
import AuthProgressSteps from "@/components/auth/AuthProgressSteps";
import AuthInlineNotice from "@/components/auth/AuthInlineNotice";

interface AuthFlowProps {
  selectedRole?: UserRole;
  onAuthenticated?: (credentials: { username: string; password: string; role: UserRole }) => void;
  onBack?: () => void;
}

type AuthMethod = "credential" | "biometric";
type AuthStep = "method-select" | "auth" | "mfa-setup" | "mfa-verify";

type PendingAuthState = {
  role: UserRole
  username: string
  password: string
  userId: string
}

const AuthenticationFlow: React.FC<AuthFlowProps> = ({ selectedRole, onAuthenticated, onBack }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInWithPassword, signOut, user } = useAuth();
  const { setActiveModule } = useAppStore();
  const resolvedRole = selectedRole ?? (searchParams.get("role") as UserRole | null);
  const policy = resolvedRole ? ROLE_AUTH_POLICIES[resolvedRole] : undefined;
  const activeRole = policy ? resolvedRole : null;
  const requiresMfa = activeRole ? requiresMfaForRole(activeRole) : false;

  const [authMethod, setAuthMethod] = useState<AuthMethod>("credential");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<AuthStep>("method-select");
  const [pendingAuth, setPendingAuth] = useState<PendingAuthState | null>(null);
  const [mfaEnrollment, setMfaEnrollment] = useState<TotpEnrollment | null>(null);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);

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

  const finalizeAuth = useCallback((credentials: { username: string; password: string; role: UserRole }) => {
    if (onAuthenticated) {
      onAuthenticated(credentials);
      return;
    }
    const destination = credentials.role === "admin" ? "/admin" : "/app";
    setActiveModule("dashboard");
    navigate(destination);
  }, [navigate, onAuthenticated, setActiveModule]);

  const handleBack = onBack ?? (async () => {
    if (step === "mfa-setup" || step === "mfa-verify" || pendingAuth) {
      await signOut();
      setPendingAuth(null);
    }
    navigate("/auth");
  });
  const usernamePattern = /^[a-zA-Z0-9._-]{3,24}$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  const buildAuthEmail = (value: string): string => {
    const trimmed = value.trim().toLowerCase();
    if (emailPattern.test(trimmed)) {
      return trimmed.replace(/@aegis\.systems$/i, "@aegis.example");
    }
    return `${trimmed}@aegis.example`;
  };

  const completeAuthentication = useCallback((credentials: { username: string; password: string; role: UserRole }) => {
    setSuccess(true);
    window.setTimeout(() => {
      finalizeAuth(credentials);
    }, 900);
  }, [finalizeAuth]);

  const resolveMfaStep = useCallback(async (
    nextAuth: PendingAuthState,
    mismatchWarning?: string | null
  ) => {
    if (!requiresMfaForRole(nextAuth.role)) {
      completeAuthentication(nextAuth);
      return;
    }

    const { data: assurance, error: assuranceError } = await fetchMfaAssurance();
    if (assuranceError) {
      throw assuranceError;
    }

    if (assurance?.currentLevel === "aal2") {
      await updateOwnMfaEnabled(nextAuth.userId, true);
      completeAuthentication(nextAuth);
      return;
    }

    const { data: factors, error: factorsError } = await listMfaFactors();
    if (factorsError) {
      throw factorsError;
    }

    setPendingAuth(nextAuth);
    setMfaCode("");
    setMfaEnrollment(null);
    setVerifiedFactorId(factors?.verifiedTotp[0]?.id ?? null);
    setWarning(
      mismatchWarning
      ?? (factors?.verifiedTotp.length
        ? "Enter your authenticator code to complete sign-in."
        : "Set up multi-factor authentication to continue.")
    );
    setStep(factors?.verifiedTotp.length ? "mfa-verify" : "mfa-setup");
  }, [completeAuthentication]);

  const validateAccessProfile = useCallback(async (userId: string, selectedRole: UserRole) => {
    const { data: profile, error: profileError } = await fetchAccessProfile(userId);

    if (profileError || !profile) {
      await signOut();
      throw new Error("Profile not found. Contact an administrator.");
    }

    if (profile.is_active === false) {
      await signOut();
      throw new Error("Your account is inactive. Contact an administrator.");
    }

    const isPrivilegedRole = profile.role !== "survivor";
    if (isPrivilegedRole && profile.approval_status !== "approved") {
      await signOut();
      const approvalMessage = profile.approval_status === "rejected"
        ? "Your privileged access request was declined. Contact an administrator."
        : profile.approval_status === "suspended"
          ? "Your privileged account is suspended. Contact an administrator."
          : "Your privileged account is pending approval. Contact an administrator.";
      throw new Error(approvalMessage);
    }

    const assignedRole = profile.role as UserRole;
    const mismatchWarning = assignedRole !== selectedRole
      ? `Signed in with your authorized ${assignedRole} role.`
      : null;

    return { assignedRole, mismatchWarning };
  }, [signOut]);

  const startMfaEnrollment = async () => {
    if (!pendingAuth) {
      return;
    }

    setError(null);
    setWarning(null);
    setMfaLoading(true);

    try {
      const { data: factors, error: factorsError } = await listMfaFactors();
      if (factorsError) {
        throw factorsError;
      }

      for (const factor of factors?.unverifiedTotp ?? []) {
        const { error: unenrollError } = await unenrollMfaFactor(factor.id);
        if (unenrollError) {
          throw unenrollError;
        }
      }

      const friendlyName = `${pendingAuth.role}-${pendingAuth.username}`;
      const { data, error } = await enrollTotpFactor(friendlyName);
      if (error || !data) {
        throw error ?? new Error("Unable to start MFA enrollment");
      }

      setMfaEnrollment(data);
      setWarning("Scan the QR code with your authenticator app, then enter the current 6-digit code.");
    } catch (enrollmentError) {
      const message = enrollmentError instanceof Error ? enrollmentError.message : "Unable to start MFA enrollment";
      setError(message);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pendingAuth) {
      setError("Your session expired. Please sign in again.");
      return;
    }

    if (!mfaCode.trim()) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    const factorId = step === "mfa-setup" ? mfaEnrollment?.id : verifiedFactorId;
    if (!factorId) {
      setError("No MFA factor is available. Start setup again.");
      return;
    }

    setMfaLoading(true);
    try {
      const { error } = step === "mfa-setup"
        ? await verifyMfaFactor(factorId, mfaCode.trim())
        : await challengeAndVerifyTotp(factorId, mfaCode.trim());

      if (error) {
        throw error;
      }

      await updateOwnMfaEnabled(pendingAuth.userId, true);
      completeAuthentication(pendingAuth);
    } catch (verificationError) {
      const message = verificationError instanceof Error ? verificationError.message : "MFA verification failed";
      setError(message);
    } finally {
      setMfaLoading(false);
    }
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

    try {
      const authEmail = buildAuthEmail(trimmedUsername);
      const { error, user: signedInUser } = await signInWithPassword(authEmail, password);
      if (error || !signedInUser) {
        const message = error?.message || "Authentication failed";
        setError(message.replace(/email/gi, "username"));
        return;
      }

      const { assignedRole, mismatchWarning } = await validateAccessProfile(signedInUser.id, activeRole);
      await resolveMfaStep(
        {
          role: assignedRole,
          username: trimmedUsername,
          password,
          userId: signedInUser.id,
        },
        mismatchWarning
      );
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Authentication failed";
      setError(message.replace(/email/gi, "username"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const resumePrivilegedAuth = async () => {
      if (!user || !activeRole || success || loading || pendingAuth) {
        return;
      }

      if (!requiresMfaForRole(activeRole)) {
        return;
      }

      try {
        const { assignedRole } = await validateAccessProfile(user.id, activeRole);
        if (!mounted) {
          return;
        }

        if (assignedRole !== activeRole) {
          await signOut();
          if (!mounted) {
            return;
          }
          setPendingAuth(null);
          setMfaEnrollment(null);
          setVerifiedFactorId(null);
          setMfaCode("");
          setPassword("");
          setError(null);
          setWarning(`Signed out of your existing ${assignedRole} session. Sign in as ${activeRole} to continue.`);
          setStep((policy?.allowedAuthMethods.length ?? 0) === 1 ? "auth" : "method-select");
          return;
        }

        await resolveMfaStep({
          role: assignedRole,
          username: username.trim() || user.email?.replace(/@aegis\.example$/i, "") || assignedRole,
          password,
          userId: user.id,
        });
      } catch (resumeError) {
        if (!mounted) {
          return;
        }
        const message = resumeError instanceof Error ? resumeError.message : "Unable to resume secure sign-in";
        setError(message);
      }
    };

    void resumePrivilegedAuth();

    return () => {
      mounted = false;
    };
  }, [activeRole, loading, password, pendingAuth, policy, resolveMfaStep, signOut, success, user, username, validateAccessProfile]);

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

  const stepLabels = step === "mfa-setup"
    ? ["Credentials", "MFA Setup"]
    : requiresMfa
      ? ["Credentials", "MFA"]
      : policy.allowedAuthMethods.length > 1
        ? ["Method", "Credentials"]
        : ["Credentials"];
  const stepIndex = step === "method-select"
    ? 0
    : step === "auth"
      ? stepLabels.length > 1 && policy.allowedAuthMethods.length > 1
        ? 1
        : 0
      : stepLabels.length - 1;
  const roleLabel = `${activeRole.charAt(0).toUpperCase()}${activeRole.slice(1)}`;
  const roleSummary = policy.requiresCredentials
    ? "Restricted role access requires verified credentials and approved clearance."
    : "Open access remains protected by identity verification and session controls.";
  const securityLevel = requiresMfa || policy.requiresBiometric ? "High assurance" : "Standard assurance";
  const securityNotes = [
    `Session timeout: ${policy.sessionTimeout} minutes`,
    `Max concurrent sessions: ${policy.maxConcurrentSessions}`,
    policy.requiresCredentials ? "Credential verification required" : "Self-service access available",
    requiresMfa ? "Multi-factor verification required" : "Single-factor verification permitted",
  ];

  return (
    <AuthSplitLayout>
      <AuthTopBar
        icon={Shield}
        title="Access Verification"
        subtitle={`${roleLabel} Authentication`}
        actionLabel="Back"
        onActionClick={handleBack}
        emergencyLabel="Emergency"
        onEmergencyClick={() => navigate("/auth")}
      />

      <motion.main
        className="grid lg:grid-cols-[0.55fr_0.45fr] gap-10 items-start"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
          <div className="space-y-6">
            <AuthContextIntro
              badge="Access protocol"
              title={`Verify your ${roleLabel} credentials`}
              description="Confirm identity, validate clearance, and activate a secure session before entering operational workflows."
              highlights={[
                { label: "Clearance", value: roleSummary },
                { label: "Security level", value: securityLevel },
              ]}
            >
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Authorized methods</p>
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
            </AuthContextIntro>

            <div className="grid gap-4 sm:grid-cols-2">
              <AuthInfoPanel
                icon={Clock3}
                title="Session controls"
                description="Access governance and time-bound enforcement."
              >
                <div className="grid gap-3 text-sm text-slate-300">
                  {securityNotes.map((note) => (
                    <div key={note} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      {note}
                    </div>
                  ))}
                </div>
              </AuthInfoPanel>

              <div className="rounded-[28px] border border-white/10 bg-slate-900/60 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500/10">
                    <Sparkles className="h-5 w-5 text-blue-200" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Current stage</p>
                    <p className="text-xs text-slate-400">The flow changes based on method and MFA requirements.</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Stage</p>
                    <p className="mt-1 text-sm font-medium text-slate-100">{stepLabels[stepIndex]}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Next action</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {step === "method-select"
                        ? "Choose a supported authentication method."
                        : step === "auth"
                          ? "Enter your credentials to continue."
                          : step === "mfa-setup"
                            ? "Enroll an authenticator app and verify the current code."
                            : "Enter the authenticator code to elevate this session."}
                    </p>
                  </div>
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
            <Card className="overflow-hidden rounded-[32px] border-white/10 bg-slate-950/75 backdrop-blur-xl shadow-slate-950/50 shadow-[0_24px_60px_rgba(2,6,23,0.65)]">
              <CardHeader className="border-b border-white/10 bg-slate-950/70">
                <CardTitle className="text-xl">Secure Authentication</CardTitle>
                <CardDescription className="text-slate-400">
                  Complete the authentication process for your {roleLabel.toLowerCase()} account
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <AuthProgressSteps labels={stepLabels} currentIndex={stepIndex} />
                <AnimatePresence mode="sync">
                  {error && (
                    <motion.div
                      key="auth-error"
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
                      key="auth-warning"
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
                      key="auth-success"
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
                      <div>
                        <Label>Select Authentication Method</Label>
                        <p className="mt-1 text-sm text-slate-400">Choose one of the methods authorized for this role.</p>
                      </div>
                      <div className="grid gap-3">
                        {policy.allowedAuthMethods.map((method) => (
                          <motion.button
                            key={method}
                            type="button"
                            onClick={() => {
                              setAuthMethod(method as AuthMethod);
                              setStep("auth");
                            }}
                            className={cn(
                              "rounded-2xl border p-4 text-left transition-all",
                              authMethod === method
                                ? "border-blue-400/60 bg-slate-900/80"
                                : "border-white/10 bg-slate-900/40 hover:border-white/30"
                            )}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                                {method === "credential" ? (
                                  <KeyRound className="h-4 w-4 text-blue-200" />
                                ) : (
                                  <Fingerprint className="h-4 w-4 text-blue-200" />
                                )}
                              </div>
                              <div>
                                <h4 className="font-semibold capitalize text-white">{method} authentication</h4>
                                <p className="mt-1 text-xs text-slate-400">
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
                      <AuthInlineNotice>
                        Use your assigned username or email alias and secure passphrase.
                      </AuthInlineNotice>
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-slate-300">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4" /> Username
                          </div>
                        </Label>
                        <Input
                          id="username"
                          type="text"
                          placeholder="Enter your username or email"
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


                  {step === "mfa-setup" && (
                    <motion.div
                      key="mfa-setup"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      <AuthInlineNotice className="bg-slate-900/60">
                        Privileged access requires a verified authenticator app before this session can continue.
                      </AuthInlineNotice>

                      {!mfaEnrollment ? (
                        <Button
                          type="button"
                          onClick={startMfaEnrollment}
                          disabled={mfaLoading}
                          className="w-full bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 hover:shadow-lg hover:shadow-blue-500/40"
                        >
                          {mfaLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Preparing MFA Setup...
                            </>
                          ) : (
                            "Generate MFA Setup"
                          )}
                        </Button>
                      ) : (
                        <form onSubmit={handleMfaVerification} className="space-y-4">
                          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
                            <div className="flex justify-center">
                              <img
                                src={mfaEnrollment.qrCode}
                                alt="Authenticator QR code"
                                className="rounded-2xl bg-white p-3 w-56 h-56"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-300">Manual setup key</Label>
                              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 font-mono text-sm break-all text-slate-200">
                                {mfaEnrollment.secret}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="mfa-setup-code" className="text-slate-300">Authenticator code</Label>
                              <Input
                                id="mfa-setup-code"
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="Enter the 6-digit code"
                                value={mfaCode}
                                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                disabled={mfaLoading}
                                className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                              />
                            </div>
                          </div>

                          <Button
                            type="submit"
                            disabled={mfaLoading || success}
                            className="w-full bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 hover:shadow-lg hover:shadow-blue-500/40"
                          >
                            {mfaLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Verifying MFA...
                              </>
                            ) : (
                              "Verify and Continue"
                            )}
                          </Button>
                        </form>
                      )}
                    </motion.div>
                  )}

                  {step === "mfa-verify" && (
                    <motion.form
                      key="mfa-verify"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={handleMfaVerification}
                      className="space-y-4"
                    >
                      <AuthInlineNotice className="bg-slate-900/60">
                        Enter the current 6-digit code from your authenticator app to elevate this session to privileged access.
                      </AuthInlineNotice>
                      <div className="space-y-2">
                        <Label htmlFor="mfa-code" className="text-slate-300">Authenticator code</Label>
                        <Input
                          id="mfa-code"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="Enter the 6-digit code"
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          disabled={mfaLoading}
                          className="bg-slate-950/70 border-slate-800 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:border-blue-400/50"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={mfaLoading || success}
                        className="w-full bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 hover:shadow-lg hover:shadow-blue-500/40"
                      >
                        {mfaLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Verifying MFA...
                          </>
                        ) : (
                          "Complete Secure Sign-In"
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

          </motion.div>
      </motion.main>
    </AuthSplitLayout>
  );
};

export default AuthenticationFlow;
