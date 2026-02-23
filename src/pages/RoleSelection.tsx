import React, { useState } from "react";
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
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserRole } from "@/types/auth";
import { ROLE_AUTH_POLICIES, canSelfRegister } from "@/lib/roleAuthPolicy";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";

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
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [hoveredRole, setHoveredRole] = useState<UserRole | null>(null);
  const { user } = useAuth();
  const [isAdminUser, setIsAdminUser] = useState(false);

  const roles: RoleOption[] = [
    {
      id: "survivor",
      label: "Survivor",
      description: "Direct access to survivor support resources and secure case management.",
      icon: <Heart className="w-7 h-7" />,
      requiresAuth: false,
      color: "from-blue-600 to-sky-500",
      badges: ["Self-registration available", "Credential login"],
      hint: "Registration and login available",
    },
    {
      id: "counselor",
      label: "Counselor",
      description: "Care providers coordinating survivor cases and intervention plans.",
      icon: <Users className="w-7 h-7" />,
      requiresAuth: true,
      color: "from-slate-700 to-blue-600",
      badges: ["Admin approval", "Credential-only"],
      hint: "Login only with authorized credentials",
    },
    {
      id: "ngo",
      label: "NGO Representative",
      description: "Partner organizations delivering outreach and protection services.",
      icon: <Briefcase className="w-7 h-7" />,
      requiresAuth: true,
      color: "from-teal-700 to-cyan-600",
      badges: ["Restricted access", "Credential-only", "Organization scoped"],
      hint: "Login only with authorized credentials",
    },
    {
      id: "police",
      label: "Police Officer",
      description: "Law enforcement personnel with investigative intelligence access.",
      icon: <Shield className="w-7 h-7" />,
      requiresAuth: true,
      color: "from-blue-700 to-indigo-600",
      badges: ["Restricted access", "Credential-only"],
      hint: "Login only with authorized credentials",
    },
    {
      id: "analyst",
      label: "Data Analyst",
      description: "Analytical teams monitoring trends and policy effectiveness.",
      icon: <BarChart3 className="w-7 h-7" />,
      requiresAuth: true,
      color: "from-slate-700 to-slate-500",
      badges: ["Admin approval", "Credential-only"],
      hint: "Login only with authorized credentials",
    },
    {
      id: "admin",
      label: "Administrator",
      description: "System owners managing governance, users, and compliance.",
      icon: <Lock className="w-7 h-7" />,
      requiresAuth: true,
      color: "from-rose-600 to-red-500",
      badges: ["Restricted access", "Credential-only", "Audit logging"],
      hint: "Login only with authorized credentials",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
  };

  const selectedRoleLabel = selectedRole
    ? roles.find((role) => role.id === selectedRole)?.label
    : null;
  const canInitialize = selectedRole ? canSelfRegister(selectedRole) || isAdminUser : false;
  const selectedPolicy = selectedRole ? ROLE_AUTH_POLICIES[selectedRole] : null;

  React.useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      if (!user) {
        setIsAdminUser(false);
        return;
      }
      const { data } = await supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle();
      if (!mounted) return;
      setIsAdminUser(data?.role === "admin");
    };
    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-[#0a1020] text-white relative">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_18%,rgba(30,64,175,0.32),transparent_46%),radial-gradient(circle_at_85%_12%,rgba(225,29,72,0.2),transparent_55%),radial-gradient(circle_at_30%_85%,rgba(148,163,184,0.18),transparent_46%)]" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(145deg,rgba(7,11,22,0.96),rgba(5,9,18,0.98))]" />

      <div className="fixed top-0 w-full z-40 border-b border-white/5 backdrop-blur-xl bg-[#0a1020]/85">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-slate-700 to-rose-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.4em] text-blue-200/70">AEGIS-AI</p>
              <p className="text-lg font-semibold">Access Command</p>
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
              className="rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              onClick={() => navigate("/")}
            >
              Back to Landing
            </Button>
          </div>
        </div>
      </div>

      <div className="pt-28 pb-16 px-4">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.4fr_0.6fr] gap-10">
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-400/30 bg-blue-500/10 text-xs uppercase tracking-[0.35em] text-blue-200">
              Access Governance
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold">Select your access role</h2>
            <p className="text-slate-300 leading-relaxed">
              Roles define authentication pathways, available modules, and secure routing policies. Restricted
              roles require verified credentials.
            </p>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 space-y-4 shadow-lg shadow-blue-500/10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-400/30 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Secure Access Guardrails</p>
                  <p className="text-xs text-slate-400">RBAC enforced at sign-in and session level.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-800/70 border border-white/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-slate-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Credential Isolation</p>
                  <p className="text-xs text-slate-400">Restricted roles require approved secrets.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 space-y-4">
              <p className="text-sm font-semibold text-slate-200">Selected role</p>
              {selectedRole ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-200 text-xs uppercase tracking-[0.35em]">
                    {selectedRoleLabel}
                  </div>
                  <div className="text-xs text-slate-400">
                    Session timeout: {selectedPolicy?.sessionTimeout} min · Max sessions: {selectedPolicy?.maxConcurrentSessions}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedPolicy?.requiresMFA || selectedPolicy?.requiresBiometric) && (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-slate-800/70 text-slate-300 border border-white/10">
                        High assurance
                      </span>
                    )}
                    {selectedPolicy?.requiresCredentials && (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-slate-800/70 text-slate-300 border border-white/10">
                        Credential required
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Choose a role to view clearance and access details.</p>
              )}
            </div>
          </motion.div>

          <motion.div
            className="space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="grid md:grid-cols-2 gap-6">
              {roles.map((role) => {
                const isSelected = selectedRole === role.id;
                const isHovered = hoveredRole === role.id;
                const policy = ROLE_AUTH_POLICIES[role.id];

                return (
                  <motion.div
                    key={role.id}
                    variants={itemVariants}
                    onHoverStart={() => setHoveredRole(role.id)}
                    onHoverEnd={() => setHoveredRole(null)}
                    onClick={() => handleRoleSelect(role.id)}
                    className="cursor-pointer"
                  >
                    <motion.div
                      className={`relative p-6 rounded-3xl border transition-all shadow-[0_22px_50px_rgba(2,6,23,0.6)] ${
                        isSelected
                          ? "border-blue-400/80 bg-slate-900/85 shadow-blue-500/30"
                          : isHovered
                            ? "border-slate-200/30 bg-slate-900/65"
                            : "border-white/10 bg-slate-950/55"
                      }`}
                      whileHover={{ scale: 1.02, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isSelected && (
                        <motion.div
                          className="absolute top-4 right-4 bg-blue-500 text-white rounded-full p-1"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200 }}
                        >
                          <CheckCircle className="w-5 h-5" />
                        </motion.div>
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${role.color} text-white shadow-lg`}
                        >
                          {role.icon}
                        </div>
                        <span
                          className={`text-[11px] px-3 py-1 rounded-full border ${
                            role.requiresAuth
                              ? "border-rose-500/40 text-rose-200 bg-rose-500/10"
                              : "border-emerald-400/40 text-emerald-200 bg-emerald-500/10"
                          }`}
                        >
                          {role.requiresAuth ? "Restricted" : "Open Access"}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold mt-4 mb-2">{role.label}</h3>
                      <p className="text-sm text-slate-400 mb-4">{role.description}</p>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 mb-4">
                        <div className="flex items-start gap-2">
                          {role.requiresAuth ? (
                            <>
                              <AlertCircle className="w-4 h-4 text-rose-300 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-rose-200">Authorization Required</p>
                                <p className="text-xs text-slate-400 mt-1">{role.hint}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 text-emerald-300 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-emerald-200">Open Registration</p>
                                <p className="text-xs text-slate-400 mt-1">{role.hint}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {role.badges.map((badge, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] px-2 py-1 rounded-full bg-slate-900/70 text-slate-300 border border-white/10"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-slate-500">
                        <span className="font-semibold">Security Level:</span>{" "}
                        {policy?.requiresMFA || policy?.requiresBiometric ? "High" : "Standard"}
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              className="rounded-2xl border border-white/15 bg-slate-950/85 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-2xl shadow-blue-500/20 backdrop-blur"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <div>
                <p className="text-sm font-semibold">Ready to continue?</p>
                <p className="text-xs text-slate-400">
                  Restricted roles require approved credentials and administrative clearance.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => selectedRole && navigate(`/auth/verify?role=${selectedRole}`)}
                  className="px-6 bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 shadow-lg shadow-blue-500/25 disabled:opacity-100 disabled:from-slate-700 disabled:via-slate-800 disabled:to-slate-900 disabled:text-slate-200 disabled:shadow-none"
                  disabled={!selectedRole}
                >
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => selectedRole && canInitialize && navigate(`/auth/initialize?role=${selectedRole}`)}
                  className="px-6 border-white/20 text-slate-100 hover:bg-white/10 disabled:opacity-100 disabled:border-slate-600 disabled:text-slate-300 disabled:bg-slate-900/70"
                  disabled={!selectedRole || !canInitialize}
                >
                  Initialize Profile
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
