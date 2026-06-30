import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle,
  Heart,
  Lock,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UserRole } from "@/types/auth";
import {
  ROLE_AUTH_POLICIES,
  canRequestPrivilegedAccess,
  canSelfRegister,
  requiresMfaForRole,
} from "@/lib/roleAuthPolicy";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import AuthTopBar from "@/components/auth/AuthTopBar";
import AuthContextIntro from "@/components/auth/AuthContextIntro";
import AuthActionSummaryCard from "@/components/auth/AuthActionSummaryCard";
import AuthMetricCard from "@/components/auth/AuthMetricCard";
import AuthCalloutCard from "@/components/auth/AuthCalloutCard";

interface RoleOption {
  id: UserRole;
  label: string;
  description: string;
  icon: React.ReactNode;
  requiresAuth: boolean;
  color: string;
  badges: string[];
  hint?: string;
}

const RoleSelection: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const { user } = useAuth();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const roles: RoleOption[] = useMemo(
    () => [
      {
        id: "survivor",
        label: t("roles.survivor.title", "Survivor"),
        description: t(
          "roles.survivor.desc",
          "Survivor support is a dedicated, private mobile app — with quick-exit, offline access, and emergency SOS.",
        ),
        icon: <Heart className="h-6 w-6" />,
        requiresAuth: false,
        color: "from-blue-500 to-sky-400",
        badges: [
          t("roles.mobileApp", "Mobile app"),
          t("roles.privateOffline", "Private & offline"),
        ],
        hint: t(
          "roles.useMobileApp",
          "Available on the AEGIS Support mobile app",
        ),
      },
      {
        id: "counselor",
        label: t("roles.counselor.title", "Counselor"),
        description: t(
          "roles.counselor.desc",
          "Care providers coordinating survivor cases and intervention plans.",
        ),
        icon: <Users className="h-6 w-6" />,
        requiresAuth: true,
        color: "from-slate-700 to-blue-600",
        badges: [
          t("roles.adminApproval", "Admin approval"),
          t("roles.credentialOnly", "Credential-only"),
        ],
        hint: t("roles.loginOnly", "Login only with authorized credentials"),
      },
      {
        id: "ngo",
        label: t("roles.ngo.title", "NGO Representative"),
        description: t(
          "roles.ngo.desc",
          "Partner organizations delivering outreach and protection services.",
        ),
        icon: <Briefcase className="h-6 w-6" />,
        requiresAuth: true,
        color: "from-teal-700 to-cyan-600",
        badges: [
          t("roles.restrictedAccess", "Restricted access"),
          t("roles.credentialOnly", "Credential-only"),
          t("roles.orgScoped", "Organization scoped"),
        ],
        hint: t("roles.loginOnly", "Login only with authorized credentials"),
      },
      {
        id: "police",
        label: t("roles.police.title", "Police Officer"),
        description: t(
          "roles.police.desc",
          "Law enforcement personnel with investigative intelligence access.",
        ),
        icon: <Shield className="h-6 w-6" />,
        requiresAuth: true,
        color: "from-blue-700 to-indigo-600",
        badges: [
          t("roles.restrictedAccess", "Restricted access"),
          t("roles.credentialOnly", "Credential-only"),
        ],
        hint: t("roles.loginOnly", "Login only with authorized credentials"),
      },
      {
        id: "analyst",
        label: t("roles.analyst.title", "Data Analyst"),
        description: t(
          "roles.analyst.desc",
          "Analytical teams monitoring trends and policy effectiveness.",
        ),
        icon: <BarChart3 className="h-6 w-6" />,
        requiresAuth: true,
        color: "from-slate-700 to-slate-500",
        badges: [
          t("roles.adminApproval", "Admin approval"),
          t("roles.credentialOnly", "Credential-only"),
        ],
        hint: t("roles.loginOnly", "Login only with authorized credentials"),
      },
      {
        id: "admin",
        label: t("roles.admin.title", "Administrator"),
        description: t(
          "roles.admin.desc",
          "System owners managing governance, users, and compliance.",
        ),
        icon: <Lock className="h-6 w-6" />,
        requiresAuth: true,
        color: "from-rose-600 to-red-500",
        badges: [
          t("roles.restrictedAccess", "Restricted access"),
          t("roles.credentialOnly", "Credential-only"),
          t("roles.auditLogging", "Audit logging"),
        ],
        hint: t("roles.loginOnly", "Login only with authorized credentials"),
      },
    ],
    [t],
  );

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
  };

  const selectedRoleConfig = selectedRole
    ? (roles.find((role) => role.id === selectedRole) ?? null)
    : null;
  // The web app is the PROFESSIONAL portal. Survivors use the dedicated mobile
  // app, so when the Survivor role is selected we offer the app, not web sign-in.
  const isSurvivor = selectedRole === "survivor";
  const mobileAppUrl = env.VITE_MOBILE_APP_URL;
  const selectedPolicy = selectedRole ? ROLE_AUTH_POLICIES[selectedRole] : null;
  const selectedRequiresMfa = selectedRole
    ? requiresMfaForRole(selectedRole)
    : false;
  const canInitialize = selectedRole
    ? canSelfRegister(selectedRole) ||
      canRequestPrivilegedAccess(selectedRole) ||
      isAdminUser
    : false;
  const initializeLabel =
    selectedRole && canRequestPrivilegedAccess(selectedRole) && !isAdminUser
      ? "Request Access"
      : "Initialize Profile";

  const initializeHint = !selectedRole
    ? "Select a role to continue."
    : canInitialize
      ? canSelfRegister(selectedRole)
        ? "This role supports self-service onboarding."
        : isAdminUser
          ? "You can provision or initialize this profile as an approved admin."
          : "This role can submit a privileged access request for review."
      : "This role can only continue with approved credentials. Use Sign In instead.";

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      if (!user) {
        setIsAdminUser(false);
        return;
      }

      setIsProfileLoading(true);
      const { data } = await supabase
        .from("user_profiles")
        .select("role,is_active,approval_status")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) {
        return;
      }

      setIsAdminUser(
        data?.role === "admin" &&
          data?.is_active !== false &&
          data?.approval_status === "approved",
      );
      setIsProfileLoading(false);
    };

    void fetchProfile();

    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070d] text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_18%,rgba(59,130,246,0.32),transparent_46%),radial-gradient(circle_at_85%_12%,rgba(244,63,94,0.22),transparent_55%),radial-gradient(circle_at_30%_85%,rgba(148,163,184,0.2),transparent_46%)]" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(145deg,rgba(7,11,22,0.9),rgba(5,9,18,0.92))]" />
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:120px_120px]" />

      <AuthTopBar
        icon={Shield}
        title="Access Command"
        subtitle="Role-based access routing"
        actionLabel={t("common.backToLanding", "Back to Landing")}
        onActionClick={() => navigate("/")}
        emergencyLabel={t("nav.emergency", "Emergency")}
        onEmergencyClick={() => navigate("/auth?priority=emergency")}
      />

      <main className="relative z-10 px-4 pb-12 pt-24 sm:px-6 lg:px-8 lg:pt-28">
        <div className="mx-auto max-w-6xl space-y-6">
          <motion.section
            className="grid gap-5 rounded-[28px] border border-white/10 bg-slate-950/60 p-5 shadow-[0_25px_60px_rgba(2,6,23,0.6)] lg:grid-cols-[0.58fr_0.42fr] lg:p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AuthContextIntro
              badge="Access Governance"
              title={t("roles.selectTitle", "Select your access role")}
              description={t(
                "roles.selectSubtitle",
                "Role-based authentication ensures each user accesses only the modules, workflows, and data appropriate to their function.",
              )}
              className="space-y-0 border-none bg-transparent p-0 shadow-none"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    title: "Guardrails",
                    body: "RBAC enforced across sign-in, session control, and audit layers.",
                  },
                  {
                    title: "Credential isolation",
                    body: "Restricted roles require verified identities and approved access.",
                  },
                  {
                    title: "Action clarity",
                    body: "Selection state now explains the next valid action before you continue.",
                  },
                ].map((item) => (
                  <AuthActionSummaryCard
                    key={item.title}
                    title={item.title}
                    description={item.body}
                  />
                ))}
              </div>
            </AuthContextIntro>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-400">
                    Selection summary
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {selectedRoleConfig
                      ? selectedRoleConfig.label
                      : "No role selected"}
                  </h2>
                </div>
                {selectedRoleConfig && (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-200">
                    Active
                  </span>
                )}
              </div>

              <div className="mt-5 space-y-4">
                <AuthCalloutCard
                  title="Current guidance"
                  description={
                    selectedRoleConfig
                      ? (selectedRoleConfig.hint ?? "")
                      : t(
                          "roles.chooseRole",
                          "Choose a role to view clearance and access details.",
                        )
                  }
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <AuthMetricCard
                    label="Session timeout"
                    value={
                      selectedPolicy
                        ? `${selectedPolicy.sessionTimeout} min`
                        : "—"
                    }
                  />
                  <AuthMetricCard
                    label="Security level"
                    value={
                      selectedRole
                        ? selectedRequiresMfa ||
                          selectedPolicy?.requiresBiometric
                          ? t("roles.high", "High")
                          : t("roles.standard", "Standard")
                        : "—"
                    }
                  />
                </div>

                <AuthCalloutCard
                  title="Initialization path"
                  description={initializeHint}
                  icon={Sparkles}
                />

                {isProfileLoading && (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                    Checking your approved admin status for privileged setup
                    actions.
                  </div>
                )}
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="grid gap-6 lg:grid-cols-[0.68fr_0.32fr]"
          >
            <div className="rounded-[32px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_25px_60px_rgba(2,6,23,0.55)] sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Roles
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Choose where you need access
                  </h2>
                </div>
                <p className="max-w-md text-sm text-slate-400">
                  Each role exposes a different operational surface, assurance
                  level, and onboarding path.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {roles.map((role) => {
                  const isSelected = selectedRole === role.id;
                  const policy = ROLE_AUTH_POLICIES[role.id];
                  const roleRequiresHighSecurity =
                    requiresMfaForRole(role.id) || policy?.requiresBiometric;

                  return (
                    <motion.button
                      key={role.id}
                      type="button"
                      onClick={() => handleRoleSelect(role.id)}
                      aria-pressed={isSelected}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        "relative rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070d]",
                        isSelected
                          ? "border-blue-300/80 bg-slate-900/90 shadow-[0_14px_40px_rgba(59,130,246,0.22)] ring-1 ring-blue-400/40"
                          : "border-white/10 bg-slate-950/75 hover:border-white/25 hover:bg-slate-900/80",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg",
                            role.color,
                          )}
                        >
                          {role.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[15px] font-semibold text-white">
                            {role.label}
                          </h3>
                          <span
                            className={cn(
                              "mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]",
                              role.requiresAuth
                                ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                                : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
                            )}
                          >
                            {role.requiresAuth
                              ? t("roles.restricted", "Restricted")
                              : t("roles.openAccess", "Open Access")}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="shrink-0 rounded-full bg-blue-500 p-1 text-white">
                            <CheckCircle className="h-4 w-4" />
                          </div>
                        )}
                      </div>

                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-300/80">
                        {role.description}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {role.badges.map((badge) => (
                          <span
                            key={badge}
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300"
                          >
                            {badge}
                          </span>
                        ))}
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                          {roleRequiresHighSecurity
                            ? t("roles.high", "High")
                            : t("roles.standard", "Standard")}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
              <motion.div
                className="rounded-[28px] border border-white/10 bg-slate-950/75 p-5 shadow-[0_25px_60px_rgba(2,6,23,0.55)]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Continue
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  Next step
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  {selectedRoleConfig
                    ? `Continue as ${selectedRoleConfig.label} using the valid path below.`
                    : "Select a role first. The available path will update automatically."}
                </p>

                {isSurvivor ? (
                  <>
                    <div className="mt-5 space-y-4">
                      <AuthActionSummaryCard
                        title="Survivor support is a mobile app"
                        description="For your privacy and safety, survivors use the dedicated AEGIS Support app — not this web portal. Your account works on both."
                      />
                    </div>
                    <div className="mt-6 flex flex-col gap-3">
                      {mobileAppUrl ? (
                        <Button
                          onClick={() =>
                            window.open(
                              mobileAppUrl,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                          className="h-12 bg-gradient-to-r from-sky-500 to-blue-600 text-base shadow-lg shadow-blue-500/25"
                        >
                          Get the AEGIS Support app
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Ask your support worker or coordinator how to install
                          the AEGIS Support app. You can sign in there with the
                          same username and passphrase.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-5 space-y-4">
                      <AuthActionSummaryCard
                        title="Sign in"
                        description="Use approved credentials to enter the secure access flow for this role."
                      />

                      <AuthActionSummaryCard
                        title="Initialize"
                        description={initializeHint}
                      />
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                      <Button
                        onClick={() =>
                          selectedRole &&
                          navigate(`/auth/verify?role=${selectedRole}`)
                        }
                        className="h-12 bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 text-base shadow-lg shadow-blue-500/25"
                        disabled={!selectedRole}
                      >
                        Sign In
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          selectedRole &&
                          canInitialize &&
                          navigate(`/auth/initialize?role=${selectedRole}`)
                        }
                        className="h-12 border-white/20 bg-white/5 text-base text-slate-100 hover:bg-white/10"
                        disabled={!selectedRole || !canInitialize}
                      >
                        {initializeLabel}
                      </Button>
                      {!canInitialize && selectedRole && (
                        <p className="text-xs text-slate-400">
                          Initialization is disabled because this role requires
                          approved credentials before onboarding.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
};

export default RoleSelection;
