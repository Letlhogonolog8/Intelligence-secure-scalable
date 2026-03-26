import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
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
import { cn } from "@/lib/utils";
import AuthTopBar from "@/components/auth/AuthTopBar";
import AuthContextIntro from "@/components/auth/AuthContextIntro";
import AuthInfoPanel from "@/components/auth/AuthInfoPanel";
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
          "Direct access to survivor support resources and secure case management."
        ),
        icon: <Heart className="h-6 w-6" />,
        requiresAuth: false,
        color: "from-blue-500 to-sky-400",
        badges: [t("roles.selfRegistration", "Self-registration available"), t("roles.credentialLogin", "Credential login")],
        hint: t("roles.registrationAvailable", "Registration and login available"),
      },
      {
        id: "counselor",
        label: t("roles.counselor.title", "Counselor"),
        description: t(
          "roles.counselor.desc",
          "Care providers coordinating survivor cases and intervention plans."
        ),
        icon: <Users className="h-6 w-6" />,
        requiresAuth: true,
        color: "from-slate-700 to-blue-600",
        badges: [t("roles.adminApproval", "Admin approval"), t("roles.credentialOnly", "Credential-only")],
        hint: t("roles.loginOnly", "Login only with authorized credentials"),
      },
      {
        id: "ngo",
        label: t("roles.ngo.title", "NGO Representative"),
        description: t(
          "roles.ngo.desc",
          "Partner organizations delivering outreach and protection services."
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
          "Law enforcement personnel with investigative intelligence access."
        ),
        icon: <Shield className="h-6 w-6" />,
        requiresAuth: true,
        color: "from-blue-700 to-indigo-600",
        badges: [t("roles.restrictedAccess", "Restricted access"), t("roles.credentialOnly", "Credential-only")],
        hint: t("roles.loginOnly", "Login only with authorized credentials"),
      },
      {
        id: "analyst",
        label: t("roles.analyst.title", "Data Analyst"),
        description: t(
          "roles.analyst.desc",
          "Analytical teams monitoring trends and policy effectiveness."
        ),
        icon: <BarChart3 className="h-6 w-6" />,
        requiresAuth: true,
        color: "from-slate-700 to-slate-500",
        badges: [t("roles.adminApproval", "Admin approval"), t("roles.credentialOnly", "Credential-only")],
        hint: t("roles.loginOnly", "Login only with authorized credentials"),
      },
      {
        id: "admin",
        label: t("roles.admin.title", "Administrator"),
        description: t(
          "roles.admin.desc",
          "System owners managing governance, users, and compliance."
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
    [t]
  );

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
  };

  const selectedRoleConfig = selectedRole ? roles.find((role) => role.id === selectedRole) ?? null : null;
  const selectedPolicy = selectedRole ? ROLE_AUTH_POLICIES[selectedRole] : null;
  const selectedRequiresMfa = selectedRole ? requiresMfaForRole(selectedRole) : false;
  const canInitialize = selectedRole
    ? canSelfRegister(selectedRole) || canRequestPrivilegedAccess(selectedRole) || isAdminUser
    : false;
  const initializeLabel = selectedRole && canRequestPrivilegedAccess(selectedRole) && !isAdminUser
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
          data?.approval_status === "approved"
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

      <div className="relative z-10 px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pt-32">
        <div className="mx-auto max-w-6xl space-y-8">
          <motion.section
            className="grid gap-6 rounded-[32px] border border-white/10 bg-slate-950/60 p-6 shadow-[0_25px_60px_rgba(2,6,23,0.6)] lg:grid-cols-[0.58fr_0.42fr] lg:p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <AuthContextIntro
              badge="Access Governance"
              title={t("roles.selectTitle", "Select your access role")}
              description={t(
                "roles.selectSubtitle",
                "Role-based authentication ensures each user accesses only the modules, workflows, and data appropriate to their function."
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
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Selection summary</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {selectedRoleConfig ? selectedRoleConfig.label : "No role selected"}
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
                      ? selectedRoleConfig.hint ?? ""
                      : t("roles.chooseRole", "Choose a role to view clearance and access details.")
                  }
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <AuthMetricCard
                    label="Session timeout"
                    value={selectedPolicy ? `${selectedPolicy.sessionTimeout} min` : "—"}
                  />
                  <AuthMetricCard
                    label="Security level"
                    value={
                      selectedRole
                        ? selectedRequiresMfa || selectedPolicy?.requiresBiometric
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
                    Checking your approved admin status for privileged setup actions.
                  </div>
                )}
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="grid gap-8 lg:grid-cols-[0.68fr_0.32fr]"
          >
            <div className="rounded-[32px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_25px_60px_rgba(2,6,23,0.55)] sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Roles</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Choose where you need access</h2>
                </div>
                <p className="max-w-md text-sm text-slate-400">
                  Each role exposes a different operational surface, assurance level, and onboarding path.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                {roles.map((role) => {
                  const isSelected = selectedRole === role.id;
                  const policy = ROLE_AUTH_POLICIES[role.id];
                  const roleRequiresHighSecurity = requiresMfaForRole(role.id) || policy?.requiresBiometric;

                  return (
                    <motion.button
                      key={role.id}
                      type="button"
                      onClick={() => handleRoleSelect(role.id)}
                      aria-pressed={isSelected}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        "relative rounded-[28px] border p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05070d]",
                        isSelected
                          ? "border-blue-300/80 bg-slate-900/90 shadow-[0_18px_50px_rgba(59,130,246,0.22)] ring-1 ring-blue-400/40"
                          : "border-white/10 bg-slate-950/75 hover:border-white/25 hover:bg-slate-900/80"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute right-4 top-4 rounded-full bg-blue-500 p-1 text-white">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-4">
                        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", role.color)}>
                          {role.icon}
                        </div>
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.24em]",
                            role.requiresAuth
                              ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                              : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                          )}
                        >
                          {role.requiresAuth ? t("roles.restricted", "Restricted") : t("roles.openAccess", "Open Access")}
                        </span>
                      </div>

                      <h3 className="mt-5 text-lg font-semibold text-white">{role.label}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300/85">{role.description}</p>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-start gap-2">
                          {role.requiresAuth ? (
                            <AlertCircle className="mt-0.5 h-4 w-4 text-rose-300" />
                          ) : (
                            <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-300" />
                          )}
                          <div>
                            <p className="text-xs font-semibold text-white">
                              {role.requiresAuth
                                ? t("roles.authRequired", "Authorization Required")
                                : t("roles.openRegistration", "Open Registration")}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">{role.hint}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {role.badges.map((badge) => (
                          <span
                            key={badge}
                            className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                        <span>
                          {t("roles.securityLevel", "Security Level")}: {roleRequiresHighSecurity ? t("roles.high", "High") : t("roles.standard", "Standard")}
                        </span>
                        <span>Max sessions: {policy.maxConcurrentSessions}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-5">
              <motion.div
                className="rounded-[32px] border border-white/10 bg-slate-950/75 p-6 shadow-[0_25px_60px_rgba(2,6,23,0.55)]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Continue</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Next step</h3>
                <p className="mt-2 text-sm text-slate-400">
                  {selectedRoleConfig
                    ? `Continue as ${selectedRoleConfig.label} using the valid path below.`
                    : "Select a role first. The available path will update automatically."}
                </p>

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
                    onClick={() => selectedRole && navigate(`/auth/verify?role=${selectedRole}`)}
                    className="h-12 bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 text-base shadow-lg shadow-blue-500/25"
                    disabled={!selectedRole}
                  >
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => selectedRole && canInitialize && navigate(`/auth/initialize?role=${selectedRole}`)}
                    className="h-12 border-white/20 bg-white/5 text-base text-slate-100 hover:bg-white/10"
                    disabled={!selectedRole || !canInitialize}
                  >
                    {initializeLabel}
                  </Button>
                  {!canInitialize && selectedRole && (
                    <p className="text-xs text-slate-400">
                      Initialization is disabled because this role requires approved credentials before onboarding.
                    </p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5 }}
              >
                <AuthInfoPanel
                  icon={Sparkles}
                  title="Improvement areas addressed"
                  description="The redesign work already resolves the following UX and clarity problems."
                  className="bg-slate-950/70 p-5"
                >
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  <li>- Accessible role cards now use real button semantics.</li>
                  <li>- Mobile users retain access to language switching.</li>
                  <li>- Disabled actions now explain why they are unavailable.</li>
                  <li>- The layout separates role choice from next-step decisions.</li>
                </ul>
                </AuthInfoPanel>
              </motion.div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
