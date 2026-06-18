import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDeletionRequests,
  useOrganizations,
  useUserProfile,
  useUserProfiles,
  useAuditLogs,
  getErrorMessage,
} from "@/data/aegisData";
import { useAuth } from "@/hooks/use-auth";
import {
  createUsernameUser,
  supabase,
  updatePrivilegedAccount,
} from "@/lib/supabase";
import { logError, logInfo } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Building2,
  Trash2,
  ShieldCheck,
  Search,
  Filter,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Activity,
  UserPlus,
  RefreshCw,
  Clock,
  Shield,
  Eye,
  EyeOff,
  AlertTriangle,
  Database,
  CheckCircle2,
  FileText,
  Copy,
  KeyRound,
  Download,
  Timer,
} from "lucide-react";
import { useDocumentVisibility } from "@/hooks/useDocumentVisibility";

const roleOptions = [
  "admin",
  "counselor",
  "analyst",
  "ngo",
  "police",
  "survivor",
] as const;
const editablePrivilegedRoleOptions = [
  "counselor",
  "analyst",
  "ngo",
  "police",
] as const;
const approvalStatusOptions = [
  "approved",
  "pending",
  "rejected",
  "suspended",
] as const;
const approvalQueueRoles = new Set(["analyst", "ngo", "police"]);
const editablePrivilegedRoles = new Set<RoleOption>(
  editablePrivilegedRoleOptions,
);

type RoleOption = (typeof roleOptions)[number];
type EditablePrivilegedRoleOption =
  (typeof editablePrivilegedRoleOptions)[number];
type ApprovalStatusOption = (typeof approvalStatusOptions)[number];

const generateTemporaryPassword = () => {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = new Uint32Array(10);
  crypto.getRandomValues(values);
  const secret = Array.from(
    values,
    (value) => charset[value % charset.length],
  ).join("");
  return `Ae!${secret}7z`;
};

const ADMIN_REAUTH_WINDOW_MS = 5 * 60 * 1000;

type UnsafeUpdateResult = { error: unknown };
type UnsafeUpdateQuery = {
  eq: (column: string, value: string) => Promise<UnsafeUpdateResult>;
};
type UnsafeUpdatableTable = {
  update: (values: Record<string, unknown>) => UnsafeUpdateQuery;
};

type AdminSectionKey =
  | "overview"
  | "approvals"
  | "identities"
  | "operations"
  | "compliance";

type AdminSectionTab = {
  key: AdminSectionKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const adminSectionTabs: AdminSectionTab[] = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "approvals", label: "Approvals", icon: ShieldCheck },
  { key: "identities", label: "Identities", icon: Users },
  { key: "operations", label: "Operations", icon: Smartphone },
  { key: "compliance", label: "Compliance", icon: FileText },
];

const AdminConsole: React.FC = () => {
  const { user, signInWithPassword, signOut } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.id);
  const isAdmin = profile?.role === "admin";
  const { setActiveModule } = useAppStore();
  const navigate = useNavigate();
  const documentVisible = useDocumentVisibility();
  const [activeSection, setActiveSection] =
    useState<AdminSectionKey>("overview");
  const [verificationClock, setVerificationClock] = useState(() => Date.now());

  const shouldLoadOrganizations =
    isAdmin &&
    ["overview", "approvals", "operations", "identities"].includes(
      activeSection,
    );
  const shouldLoadUsers =
    isAdmin && ["overview", "approvals", "identities"].includes(activeSection);
  const shouldLoadDeletionRequests =
    isAdmin && ["overview", "compliance"].includes(activeSection);
  const shouldLoadAuditLogs =
    isAdmin && ["overview", "compliance"].includes(activeSection);

  const {
    data: organizations = [],
    isLoading: orgLoading,
    refetch: refetchOrganizations,
  } = useOrganizations({ enabled: shouldLoadOrganizations, limit: 100 });
  const {
    data: users = [],
    isLoading: userLoading,
    refetch: refetchUsers,
  } = useUserProfiles({ enabled: shouldLoadUsers, limit: 200 });
  const {
    data: deletionRequests = [],
    isLoading: deletionLoading,
    refetch: refetchDeletionRequests,
  } = useDeletionRequests({
    enabled: shouldLoadDeletionRequests,
    staleTime: 30000,
    refetchInterval:
      activeSection === "overview" && documentVisible ? 60000 : undefined,
  });
  const {
    data: auditLogs = [],
    isLoading: auditLoading,
    refetch: refetchAuditLogs,
  } = useAuditLogs({
    enabled: shouldLoadAuditLogs,
    limit: 100,
    staleTime: 30000,
    refetchInterval:
      activeSection === "overview" && documentVisible ? 60000 : undefined,
  });

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [organizationAssignments, setOrganizationAssignments] = useState<
    Record<string, string | null>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [userPage, setUserPage] = useState(0);
  const [orgPage, setOrgPage] = useState(0);

  const [ussdSessionId, setUssdSessionId] = useState("");
  const [ussdPhoneNumber, setUssdPhoneNumber] = useState("");
  const [ussdServiceCode, setUssdServiceCode] = useState("");
  const [ussdText, setUssdText] = useState("");
  const [ussdCurrentInput, setUssdCurrentInput] = useState("");
  const [ussdResponse, setUssdResponse] = useState<string | null>(null);
  const [ussdLoading, setUssdLoading] = useState(false);
  const [ussdMenuType, setUssdMenuType] = useState<"CON" | "END">("CON");

  // Provisioning state
  const [isProvisionDialogOpen, setIsProvisionDialogOpen] = useState(false);
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [showProvisionPassword, setShowProvisionPassword] = useState(false);
  const [provisionForm, setProvisionForm] = useState({
    fullName: "",
    username: "",
    role: "counselor" as RoleOption,
    password: "",
    organizationId: "" as string | null,
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    role: "counselor" as EditablePrivilegedRoleOption,
    organizationId: null as string | null,
    username: "",
    password: "",
    approvalStatus: "approved" as ApprovalStatusOption,
    isActive: true,
  });
  const [resetLoadingId, setResetLoadingId] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetCredentialName, setResetCredentialName] = useState("");
  const [resetCredentialPassword, setResetCredentialPassword] = useState("");
  const [isAdminVerifyDialogOpen, setIsAdminVerifyDialogOpen] = useState(false);
  const [adminVerifyPassword, setAdminVerifyPassword] = useState("");
  const [adminVerifyError, setAdminVerifyError] = useState<string | null>(null);
  const [adminVerifyLoading, setAdminVerifyLoading] = useState(false);
  const [pendingAdminActionLabel, setPendingAdminActionLabel] = useState("");
  const [adminVerifiedUntil, setAdminVerifiedUntil] = useState(0);
  const pendingAdminActionRef = useRef<(() => Promise<void>) | null>(null);

  const [auditSearch, setAuditSearch] = useState("");
  const [auditSeverity, setAuditSeverity] = useState<string>("all");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredAuditSearch = useDeferredValue(auditSearch);

  const usersPerPage = 10;
  const orgsPerPage = 5;

  const verifiedOrganizations = useMemo(
    () =>
      organizations.filter((org) => org.supportsVerification && org.isVerified)
        .length,
    [organizations],
  );
  const unverifiedOrganizations = useMemo(
    () =>
      organizations.filter((org) => org.supportsVerification && !org.isVerified)
        .length,
    [organizations],
  );
  const organizationsAwaitingSchemaSync = useMemo(
    () => organizations.filter((org) => !org.supportsVerification).length,
    [organizations],
  );
  const activeUsers = useMemo(
    () => users.filter((u) => u.isActive).length,
    [users],
  );
  const inactiveUsers = useMemo(
    () => users.filter((u) => !u.isActive).length,
    [users],
  );
  const pendingRequests = useMemo(
    () => deletionRequests.filter((r) => r.status !== "processed").length,
    [deletionRequests],
  );
  const managedPrivilegedUsers = useMemo(
    () =>
      users.filter((u) => editablePrivilegedRoles.has(u.role as RoleOption))
        .length,
    [users],
  );
  const protectedUsers = useMemo(
    () => users.filter((u) => u.role !== "survivor").length,
    [users],
  );
  const mfaProtectedUsers = useMemo(
    () => users.filter((u) => u.role !== "survivor" && u.mfaEnabled).length,
    [users],
  );
  const pendingApprovalProfiles = useMemo(
    () =>
      users.filter(
        (u) => approvalQueueRoles.has(u.role) && u.approvalStatus === "pending",
      ),
    [users],
  );
  const pendingApprovalCount = pendingApprovalProfiles.length;
  const adminAttentionItems =
    pendingApprovalCount + pendingRequests + organizationsAwaitingSchemaSync;
  const adminStepUpActive = adminVerifiedUntil > verificationClock;
  const adminStepUpMinutesRemaining = Math.max(
    0,
    Math.ceil((adminVerifiedUntil - verificationClock) / 60000),
  );

  const filteredProfiles = useMemo(() => {
    const normalized = deferredSearchQuery.trim().toLowerCase();
    let results = users;
    if (normalized) {
      results = results.filter(
        (item) =>
          item.fullName?.toLowerCase().includes(normalized) ||
          item.role.toLowerCase().includes(normalized) ||
          item.id.toLowerCase().includes(normalized),
      );
    }
    if (showInactiveOnly) {
      results = results.filter((item) => !item.isActive);
    }
    return results;
  }, [users, deferredSearchQuery, showInactiveOnly]);

  const filteredAuditLogs = useMemo(() => {
    let logs = auditLogs;
    if (deferredAuditSearch) {
      const search = deferredAuditSearch.toLowerCase();
      logs = logs.filter(
        (log) =>
          log.action.toLowerCase().includes(search) ||
          log.description?.toLowerCase().includes(search) ||
          log.user?.toLowerCase().includes(search),
      );
    }
    if (auditSeverity !== "all") {
      logs = logs.filter(
        (log) => (log.severity ?? "").toLowerCase() === auditSeverity,
      );
    }
    return logs;
  }, [auditLogs, deferredAuditSearch, auditSeverity]);

  const totalUserPages = Math.max(
    1,
    Math.ceil(filteredProfiles.length / usersPerPage),
  );
  const pagedProfiles = useMemo(
    () =>
      filteredProfiles.slice(
        userPage * usersPerPage,
        userPage * usersPerPage + usersPerPage,
      ),
    [filteredProfiles, userPage, usersPerPage],
  );

  const totalOrgPages = Math.max(
    1,
    Math.ceil(organizations.length / orgsPerPage),
  );
  const pagedOrganizations = useMemo(
    () =>
      organizations.slice(
        orgPage * orgsPerPage,
        orgPage * orgsPerPage + orgsPerPage,
      ),
    [organizations, orgPage, orgsPerPage],
  );

  useEffect(() => {
    if (userPage > totalUserPages - 1)
      setUserPage(Math.max(0, totalUserPages - 1));
  }, [totalUserPages, userPage]);

  useEffect(() => {
    if (orgPage > totalOrgPages - 1) setOrgPage(Math.max(0, totalOrgPages - 1));
  }, [totalOrgPages, orgPage]);

  useEffect(() => {
    setUserPage(0);
  }, [deferredSearchQuery, showInactiveOnly]);

  useEffect(() => {
    setOrganizationAssignments((current) => {
      const validUserIds = new Set(users.map((item) => item.id));
      let changed = false;
      const next = Object.fromEntries(
        Object.entries(current).filter(([userId]) => {
          const keep = validUserIds.has(userId);
          if (!keep) changed = true;
          return keep;
        }),
      );
      return changed ? next : current;
    });
  }, [users]);

  useEffect(() => {
    if (!adminStepUpActive) {
      setVerificationClock(Date.now());
      return;
    }

    const intervalId = window.setInterval(() => {
      setVerificationClock(Date.now());
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [adminStepUpActive]);

  useEffect(() => {
    pendingAdminActionRef.current = null;
    setPendingAdminActionLabel("");
    setAdminVerifyPassword("");
    setAdminVerifyError(null);
    setIsAdminVerifyDialogOpen(false);
    setAdminVerifiedUntil(0);
  }, [user?.id]);

  const closeAdminVerifyDialog = () => {
    pendingAdminActionRef.current = null;
    setPendingAdminActionLabel("");
    setAdminVerifyPassword("");
    setAdminVerifyError(null);
    setIsAdminVerifyDialogOpen(false);
  };

  const runAdminProtectedAction = async (
    actionLabel: string,
    action: () => Promise<void>,
  ) => {
    if (!isAdmin) {
      toast.error("Unauthorized: Admin privileges required");
      return;
    }

    if (Date.now() < adminVerifiedUntil) {
      await action();
      return;
    }

    pendingAdminActionRef.current = action;
    setPendingAdminActionLabel(actionLabel);
    setAdminVerifyPassword("");
    setAdminVerifyError(null);
    setIsAdminVerifyDialogOpen(true);
  };

  const handleAdminStepUpVerification = async () => {
    if (!user?.email) {
      setAdminVerifyError(
        "Your admin session is missing an email identity. Please sign in again.",
      );
      return;
    }

    if (!adminVerifyPassword.trim()) {
      setAdminVerifyError("Enter your admin passphrase to continue.");
      return;
    }

    setAdminVerifyLoading(true);
    setAdminVerifyError(null);

    try {
      const { error, user: verifiedUser } = await signInWithPassword(
        user.email,
        adminVerifyPassword,
      );
      if (error || !verifiedUser) {
        throw error ?? new Error("Unable to verify your admin credentials");
      }

      if (verifiedUser.id !== user.id) {
        await signOut();
        throw new Error(
          "Admin verification failed because the active account changed. Please sign in again.",
        );
      }

      setAdminVerifiedUntil(Date.now() + ADMIN_REAUTH_WINDOW_MS);
      const pendingAction = pendingAdminActionRef.current;
      closeAdminVerifyDialog();
      if (pendingAction) {
        await pendingAction();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to verify your admin credentials";
      setAdminVerifyError(message.replace(/email/gi, "username"));
    } finally {
      setAdminVerifyLoading(false);
    }
  };

  const withUpdating = async (id: string, action: () => Promise<void>) => {
    setUpdatingId(id);
    try {
      await action();
    } finally {
      setUpdatingId(null);
    }
  };

  const updateTable = (
    table: "user_profiles" | "organizations" | "data_deletion_requests",
  ) => {
    return supabase.from(table) as unknown as UnsafeUpdatableTable;
  };

  const handleRoleChange = async (userId: string, nextRole: RoleOption) => {
    await runAdminProtectedAction("change a user role", async () => {
      await withUpdating(userId, async () => {
        const { error } = await updateTable("user_profiles")
          .update({ role: nextRole, updated_at: new Date().toISOString() })
          .eq("id", userId);

        if (error) {
          logError(error, { source: "admin.role_update", userId, nextRole });
          toast.error("Failed to update role");
        } else {
          logInfo("Role updated", { userId, nextRole });
          toast.success("Role updated successfully");
          refetchUsers();
        }
      });
    });
  };

  const handleStatusToggle = async (userId: string, nextStatus: boolean) => {
    await runAdminProtectedAction("change account status", async () => {
      await withUpdating(userId, async () => {
        const { error } = await updateTable("user_profiles")
          .update({
            is_active: nextStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (error) {
          logError(error, {
            source: "admin.status_update",
            userId,
            nextStatus,
          });
          toast.error("Failed to update status");
        } else {
          logInfo("Status updated", { userId, nextStatus });
          toast.success(
            `Account ${nextStatus ? "activated" : "suspended"} successfully`,
          );
          refetchUsers();
        }
      });
    });
  };

  const handleApprovalDecision = async (
    userId: string,
    decision: "approved" | "rejected",
  ) => {
    const pendingProfile = users.find((item) => item.id === userId);
    if (!pendingProfile) {
      toast.error("Unable to load the requested profile");
      return;
    }

    const assignedOrganizationId =
      organizationAssignments[userId] ?? pendingProfile.organizationId ?? null;
    if (
      decision === "approved" &&
      (pendingProfile.role === "ngo" || pendingProfile.role === "police") &&
      !assignedOrganizationId
    ) {
      toast.error(
        "Assign an organization before approving NGO or Police access",
      );
      return;
    }

    await runAdminProtectedAction(
      `${decision === "approved" ? "approve" : "decline"} privileged access requests`,
      async () => {
        await withUpdating(userId, async () => {
          const payload =
            decision === "approved"
              ? {
                  approval_status: "approved",
                  is_active: true,
                  organization_id: assignedOrganizationId,
                  approved_by: user?.id ?? null,
                  approved_at: new Date().toISOString(),
                  role_assigned_by: user?.id ?? null,
                  updated_at: new Date().toISOString(),
                }
              : {
                  approval_status: "rejected",
                  is_active: false,
                  updated_at: new Date().toISOString(),
                };

          const { error } = await updateTable("user_profiles")
            .update(payload)
            .eq("id", userId);

          if (error) {
            logError(error, {
              source: "admin.approval_decision",
              userId,
              decision,
              assignedOrganizationId,
            });
            toast.error(
              `Failed to ${decision === "approved" ? "approve" : "decline"} request`,
            );
          } else {
            logInfo("Approval decision saved", {
              userId,
              decision,
              assignedOrganizationId,
            });
            toast.success(
              `Request ${decision === "approved" ? "approved" : "declined"} successfully`,
            );
            setOrganizationAssignments((current) => {
              const next = { ...current };
              delete next[userId];
              return next;
            });
            refetchUsers();
          }
        });
      },
    );
  };

  const handleProvisionUser = async () => {
    logInfo("Attempting to provision user", {
      isAdmin,
      role: provisionForm.role,
      username: provisionForm.username.trim(),
      hasOrganization: Boolean(provisionForm.organizationId),
    });

    if (
      !provisionForm.fullName ||
      !provisionForm.username ||
      !provisionForm.password
    ) {
      toast.error(
        "Please fill in all required fields (Full Name, Username, and Password)",
      );
      return;
    }

    const usernamePattern = /^[a-zA-Z0-9._-]{3,24}$/;
    if (!usernamePattern.test(provisionForm.username.trim())) {
      toast.error(
        "Invalid username format. Use 3-24 characters (letters, numbers, dots, underscores, or hyphens)",
      );
      return;
    }

    if (provisionForm.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (
      (provisionForm.role === "ngo" || provisionForm.role === "police") &&
      !provisionForm.organizationId
    ) {
      toast.error(
        "Select an affiliated organization before provisioning NGO or Police accounts",
      );
      return;
    }

    await runAdminProtectedAction(
      "provision a specialized account",
      async () => {
        setProvisionLoading(true);
        try {
          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession();
          const session = refreshData.session;

          if (refreshError || !session?.access_token) {
            logError(refreshError || new Error("No active session found"), {
              source: "admin.session_check",
            });
            toast.error(
              "Your session has expired. Please log out and log back in.",
            );
            return;
          }
          logInfo("Invoking create_username_user Edge Function");
          const timestamp = new Date().toISOString();

          const { data: createData, error: createError } =
            await createUsernameUser(
              {
                username: provisionForm.username.trim(),
                password: provisionForm.password,
                full_name: provisionForm.fullName.trim(),
                profile: {
                  role: provisionForm.role,
                  full_name: provisionForm.fullName.trim(),
                  is_active: true,
                  organization_id: provisionForm.organizationId || null,
                  approval_status: "approved",
                  mfa_enabled: false,
                  role_assigned_by: user?.id ?? null,
                  approved_by: user?.id ?? null,
                  approved_at: timestamp,
                },
              },
              session?.access_token ?? null,
            );

          if (
            createError ||
            createData?.success === false ||
            !createData?.user_id
          ) {
            logError(createError || new Error(createData?.error), {
              source: "admin.provision_user.edge_function",
              createData,
            });
            throw new Error(
              createData?.error ||
                createError?.message ||
                "Failed to create authentication record",
            );
          }

          const userId = createData.user_id;
          logInfo("Provisioned user through secure edge function", {
            userId,
            role: provisionForm.role,
          });

          toast.success(
            `Account provisioned successfully for ${provisionForm.fullName}`,
          );
          setIsProvisionDialogOpen(false);
          setProvisionForm({
            fullName: "",
            username: "",
            role: "counselor",
            password: "",
            organizationId: null,
          });
          refetchUsers();
        } catch (err) {
          const message = getErrorMessage(err);
          logError(err, { source: "admin.provision_user" });

          const toastMessage =
            typeof message === "string"
              ? message
              : "An unexpected error occurred during provisioning";
          toast.error(`Provisioning failed: ${toastMessage}`);
        } finally {
          setProvisionLoading(false);
        }
      },
    );
  };

  const handleOpenEditDialog = (item: (typeof users)[number]) => {
    if (!editablePrivilegedRoles.has(item.role as RoleOption)) {
      toast.error(
        "This dashboard editor supports Police, NGO, Analyst, and Counselor profiles only",
      );
      return;
    }

    const derivedApprovalStatus = (item.approvalStatus ??
      (item.isActive ? "approved" : "suspended")) as ApprovalStatusOption;
    setEditingProfileId(item.id);
    setShowEditPassword(false);
    setEditForm({
      fullName: item.fullName || "",
      role: item.role as EditablePrivilegedRoleOption,
      organizationId: item.organizationId ?? null,
      username: "",
      password: "",
      approvalStatus: derivedApprovalStatus,
      isActive: derivedApprovalStatus === "approved" ? item.isActive : false,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateManagedProfile = async () => {
    if (!editingProfileId) {
      toast.error("Select a managed profile before saving changes");
      return;
    }

    if (!editForm.fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    const usernamePattern = /^[a-zA-Z0-9._-]{3,24}$/;
    const trimmedUsername = editForm.username.trim();
    if (trimmedUsername && !usernamePattern.test(trimmedUsername)) {
      toast.error(
        "Invalid username format. Use 3-24 characters (letters, numbers, dots, underscores, or hyphens)",
      );
      return;
    }

    const trimmedPassword = editForm.password.trim();
    if (trimmedPassword && trimmedPassword.length < 8) {
      toast.error("Temporary password must be at least 8 characters");
      return;
    }

    if (
      (editForm.role === "ngo" || editForm.role === "police") &&
      !editForm.organizationId
    ) {
      toast.error(
        "Assign an affiliated organization before saving NGO or Police accounts",
      );
      return;
    }

    const normalizedIsActive =
      editForm.approvalStatus === "approved" ? editForm.isActive : false;

    await runAdminProtectedAction(
      "edit a managed privileged profile",
      async () => {
        setEditLoading(true);
        try {
          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession();
          const session = refreshData.session;

          if (refreshError || !session?.access_token) {
            logError(refreshError || new Error("No active session found"), {
              source: "admin.edit_profile.session_check",
            });
            toast.error(
              "Your session has expired. Please log out and log back in.",
            );
            return;
          }
          const { data: updateData, error: updateError } =
            await updatePrivilegedAccount(
              {
                target_user_id: editingProfileId,
                username: trimmedUsername || undefined,
                password: trimmedPassword || undefined,
                profile: {
                  full_name: editForm.fullName.trim(),
                  role: editForm.role,
                  organization_id: editForm.organizationId,
                  approval_status: editForm.approvalStatus,
                  is_active: normalizedIsActive,
                },
              },
              session.access_token,
            );

          if (
            updateError ||
            updateData?.success === false ||
            !updateData?.user_id
          ) {
            logError(updateError || new Error(updateData?.error), {
              source: "admin.edit_profile.edge_function",
              updateData,
              editingProfileId,
            });
            throw new Error(
              updateData?.error ||
                updateError?.message ||
                "Failed to update the managed profile",
            );
          }

          logInfo("Managed profile updated", {
            editingProfileId,
            role: editForm.role,
          });
          toast.success("Managed profile updated successfully");
          setIsEditDialogOpen(false);
          setEditingProfileId(null);
          setEditForm({
            fullName: "",
            role: "counselor",
            organizationId: null,
            username: "",
            password: "",
            approvalStatus: "approved",
            isActive: true,
          });
          refetchUsers();
        } catch (err) {
          const message = getErrorMessage(err);
          logError(err, { source: "admin.edit_profile", editingProfileId });
          toast.error(
            `Profile update failed: ${typeof message === "string" ? message : "Unexpected error"}`,
          );
        } finally {
          setEditLoading(false);
        }
      },
    );
  };

  const handleResetCredentials = async (item: (typeof users)[number]) => {
    if (!editablePrivilegedRoles.has(item.role as RoleOption)) {
      toast.error(
        "Only managed Police, NGO, Analyst, and Counselor accounts can be reset here",
      );
      return;
    }

    await runAdminProtectedAction(
      "reset managed account credentials",
      async () => {
        setResetLoadingId(item.id);
        try {
          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession();
          const session = refreshData.session;

          if (refreshError || !session?.access_token) {
            logError(refreshError || new Error("No active session found"), {
              source: "admin.reset_credentials.session_check",
            });
            toast.error(
              "Your session has expired. Please log out and log back in.",
            );
            return;
          }

          const temporaryPassword = generateTemporaryPassword();
          const { data: updateData, error: updateError } =
            await updatePrivilegedAccount(
              {
                target_user_id: item.id,
                password: temporaryPassword,
              },
              session.access_token,
            );

          if (
            updateError ||
            updateData?.success === false ||
            !updateData?.user_id
          ) {
            logError(updateError || new Error(updateData?.error), {
              source: "admin.reset_credentials.edge_function",
              userId: item.id,
            });
            throw new Error(
              updateData?.error ||
                updateError?.message ||
                "Failed to reset credentials",
            );
          }

          setResetCredentialName(item.fullName || "Managed account");
          setResetCredentialPassword(temporaryPassword);
          setIsResetDialogOpen(true);
          toast.success("Temporary password generated successfully");
        } catch (err) {
          const message = getErrorMessage(err);
          logError(err, { source: "admin.reset_credentials", userId: item.id });
          toast.error(
            `Credential reset failed: ${typeof message === "string" ? message : "Unexpected error"}`,
          );
        } finally {
          setResetLoadingId(null);
        }
      },
    );
  };

  const handleCopyResetPassword = async () => {
    try {
      await navigator.clipboard.writeText(resetCredentialPassword);
      toast.success("Temporary password copied to clipboard");
    } catch (error) {
      logError(error, { source: "admin.reset_credentials.copy" });
      toast.error("Unable to copy the temporary password");
    }
  };

  const closeResetDialog = () => {
    setIsResetDialogOpen(false);
    setResetCredentialName("");
    setResetCredentialPassword("");
  };

  const handleRefreshVisibleData = async () => {
    setRefreshLoading(true);
    try {
      const tasks: Array<Promise<unknown>> = [];
      if (shouldLoadOrganizations) tasks.push(refetchOrganizations());
      if (shouldLoadUsers) tasks.push(refetchUsers());
      if (shouldLoadDeletionRequests) tasks.push(refetchDeletionRequests());
      if (shouldLoadAuditLogs) tasks.push(refetchAuditLogs());
      await Promise.all(tasks);
      toast.success("Visible admin data refreshed");
    } finally {
      setRefreshLoading(false);
    }
  };

  const handleExportAuditCsv = useCallback(() => {
    if (filteredAuditLogs.length === 0) {
      toast.error("No audit logs to export");
      return;
    }
    const header = [
      "Time",
      "Action",
      "Module",
      "User",
      "Severity",
      "Description",
    ];
    const rows = filteredAuditLogs.map((log) =>
      [
        log.time,
        log.action,
        log.module,
        log.user ?? "system",
        log.severity ?? "info",
        (log.description ?? "").replace(/"/g, '""'),
      ]
        .map((cell) => `"${cell}"`)
        .join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aegis-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredAuditLogs.length} audit records`);
  }, [filteredAuditLogs]);

  const handleOrgVerificationToggle = async (
    orgId: string,
    nextStatus: boolean,
  ) => {
    const targetOrganization = organizations.find((item) => item.id === orgId);
    if (!targetOrganization?.supportsVerification) {
      toast.error(
        "Organization verification is unavailable until the Supabase verification field is deployed.",
      );
      return;
    }

    await runAdminProtectedAction(
      "verify or revoke an organization",
      async () => {
        await withUpdating(orgId, async () => {
          const { error } = await updateTable("organizations")
            .update({
              is_verified: nextStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", orgId);

          if (error) {
            logError(error, { source: "admin.org_verify", orgId, nextStatus });
            toast.error("Failed to update organization status");
          } else {
            logInfo("Organization status updated", { orgId, nextStatus });
            toast.success(
              `Organization ${nextStatus ? "verified" : "revoked"} successfully`,
            );
            refetchOrganizations();
          }
        });
      },
    );
  };

  const handleProcessDeletionRequest = async (requestId: string) => {
    await runAdminProtectedAction("process a deletion request", async () => {
      await withUpdating(requestId, async () => {
        const { error } = await updateTable("data_deletion_requests")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
            processed_by: user?.id,
          })
          .eq("id", requestId);

        if (error) {
          logError(error, { source: "admin.deletion_process", requestId });
          toast.error("Failed to process deletion request");
        } else {
          logInfo("Deletion request processed", { requestId });
          toast.success("Request marked as processed");
          refetchDeletionRequests();
        }
      });
    });
  };

  const handleUssdSend = async (appendInput?: string) => {
    if (!isAdmin) return;
    if (
      !ussdSessionId.trim() ||
      !ussdPhoneNumber.trim() ||
      !ussdServiceCode.trim()
    ) {
      setUssdResponse(
        "Session ID, phone number, and service code are required.",
      );
      return;
    }

    setUssdLoading(true);

    let nextText = ussdText;
    if (appendInput !== undefined) {
      nextText = ussdText ? `${ussdText}*${appendInput}` : appendInput;
      setUssdText(nextText);
    }

    try {
      const apiBaseUrl = (
        import.meta.env.VITE_API_URL || "http://localhost:3001/api"
      ).replace(/\/+$/, "");
      const response = await fetch(`${apiBaseUrl}/ussd/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          sessionId: ussdSessionId.trim(),
          phoneNumber: ussdPhoneNumber.trim(),
          serviceCode: ussdServiceCode.trim(),
          text: nextText.trim(),
        }).toString(),
      });

      const responseBody = await response.text();
      if (!response.ok) {
        throw new Error(
          responseBody || `USSD request failed with status ${response.status}`,
        );
      }

      let parsedResponse = responseBody;
      if (parsedResponse.startsWith("CON ")) {
        setUssdMenuType("CON");
        parsedResponse = parsedResponse.substring(4);
      } else if (parsedResponse.startsWith("END ")) {
        setUssdMenuType("END");
        parsedResponse = parsedResponse.substring(4);
      } else {
        setUssdMenuType("CON");
      }

      setUssdResponse(parsedResponse || "No response returned.");
    } catch (err) {
      logError(err, { source: "admin.ussd" });
      setUssdResponse(String(err));
      setUssdMenuType("END");
    } finally {
      setUssdLoading(false);
      setUssdCurrentInput("");
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#050810] text-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-500">
            Verifying Security Credentials...
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#050810] text-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-rose-500/20 bg-rose-500/5 p-8 text-center backdrop-blur-xl">
          <Shield className="h-16 w-16 text-rose-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-white mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-8 font-medium">
            Your current security clearance level is insufficient to access the
            Enterprise Control Hub. This attempt has been logged.
          </p>
          <Button
            className="w-full h-12 bg-white text-black hover:bg-slate-200 font-black uppercase tracking-widest"
            onClick={() => {
              setActiveModule("dashboard");
              navigate("/app");
            }}
          >
            Return to Safety
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050915] text-slate-50 px-4 py-6 md:px-6 md:py-8 relative overflow-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 left-[8%] h-72 w-72 rounded-full bg-sky-500/15 blur-[110px]" />
        <div className="absolute -bottom-28 right-[6%] h-80 w-80 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:32px_32px] opacity-10" />
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:gap-8 relative z-10">
        <header className="relative overflow-hidden rounded-3xl border border-sky-400/20 bg-slate-900/65 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl md:p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-transparent to-emerald-500/10" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-sky-200">
                <Users className="h-3.5 w-3.5" />
                Enterprise Control Hub
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl lg:text-5xl">
                Admin Console
              </h1>
              <p className="max-w-2xl text-sm text-slate-300 md:text-base">
                Full oversight of organizations, identities, and zero-trust
                access protocols within the AEGIS ecosystem.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                  {Math.round(
                    (mfaProtectedUsers / (protectedUsers || 1)) * 100,
                  )}
                  % MFA coverage
                </span>
                <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">
                  {pendingApprovalCount} approvals pending
                </span>
                <span className="rounded-full border border-rose-400/25 bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-300">
                  {pendingRequests} deletion requests
                </span>
                {adminStepUpActive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                    <Timer className="h-3 w-3" />
                    Verified · {adminStepUpMinutesRemaining}m remaining
                  </span>
                ) : (
                  <span className="rounded-full border border-slate-600/25 bg-slate-800/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    Step-up required
                  </span>
                )}
                {!documentVisible && (
                  <span className="rounded-full border border-slate-600/20 bg-slate-900/60 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                    Polling paused
                  </span>
                )}
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => {
                  setActiveModule("dashboard");
                  navigate("/app");
                }}
              >
                <ChevronLeft className="mr-2 h-4 w-4 text-sky-300" />
                Return to Dashboard
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => void handleRefreshVisibleData()}
                disabled={refreshLoading}
                aria-busy={refreshLoading}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 text-emerald-300 ${refreshLoading ? "animate-spin" : ""}`}
                />
                {refreshLoading ? "Refreshing…" : "Refresh Data"}
              </Button>
              <Button
                size="lg"
                className="h-12 bg-sky-600 text-white hover:bg-sky-500 shadow-lg shadow-sky-900/30"
                onClick={() => setIsProvisionDialogOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Provision Account
              </Button>
            </div>
          </div>
        </header>

        <main className="contents">
          <Card className="border-white/10 bg-slate-900/60 p-2 backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {adminSectionTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeSection === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveSection(tab.key)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-[11px] font-black uppercase tracking-[0.14em] transition-all",
                      isActive
                        ? "border-sky-500/40 bg-sky-500/15 text-sky-100 shadow-lg shadow-sky-900/20"
                        : "border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Provisioning Dialog */}
          <Dialog
            open={isProvisionDialogOpen}
            onOpenChange={setIsProvisionDialogOpen}
          >
            <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md backdrop-blur-2xl shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black flex items-center gap-3">
                  <UserPlus className="h-6 w-6 text-indigo-400" />
                  Provision Specialized Account
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Create authenticated credentials for specialized platform
                  roles.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="fullName"
                    className="text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    placeholder="Enter full legal name"
                    className="bg-slate-950 border-white/5 text-white h-12"
                    value={provisionForm.fullName}
                    onChange={(e) =>
                      setProvisionForm((prev) => ({
                        ...prev,
                        fullName: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Username (Identifier)
                  </Label>
                  <div className="relative">
                    <Input
                      id="username"
                      placeholder="e.g. officer.smith"
                      className="bg-slate-950 border-white/5 text-white h-12"
                      value={provisionForm.username}
                      onChange={(e) =>
                        setProvisionForm((prev) => ({
                          ...prev,
                          username: e.target.value,
                        }))
                      }
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase">
                      @aegis.example
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Account Role
                    </Label>
                    <Select
                      value={provisionForm.role}
                      onValueChange={(val: RoleOption) =>
                        setProvisionForm((prev) => ({ ...prev, role: val }))
                      }
                    >
                      <SelectTrigger className="bg-slate-950 border-white/5 text-white h-12">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        <SelectItem value="police">Police Officer</SelectItem>
                        <SelectItem value="ngo">NGO Partner</SelectItem>
                        <SelectItem value="counselor">
                          Specialized Counselor
                        </SelectItem>
                        <SelectItem value="analyst">Data Analyst</SelectItem>
                        <SelectItem value="admin">System Admin ⚠️</SelectItem>
                      </SelectContent>
                    </Select>
                    {provisionForm.role === "admin" && (
                      <p className="text-[10px] text-amber-400 font-bold mt-1">
                        ⚠️ System Admin grants full platform control. Use only
                        for trusted operators.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="password"
                      className="text-xs font-black uppercase tracking-widest text-slate-500"
                    >
                      Initial Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showProvisionPassword ? "text" : "password"}
                        className="bg-slate-950 border-white/5 text-white h-12 pr-10"
                        value={provisionForm.password}
                        onChange={(e) =>
                          setProvisionForm((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowProvisionPassword(!showProvisionPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                      >
                        {showProvisionPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Affiliated Organization
                  </Label>
                  <Select
                    value={provisionForm.organizationId || "none"}
                    onValueChange={(val) =>
                      setProvisionForm((prev) => ({
                        ...prev,
                        organizationId: val === "none" ? null : val,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-slate-950 border-white/5 text-white h-12">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white max-h-60">
                      <SelectItem value="none">No Affiliation</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="mt-6 gap-3 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => setIsProvisionDialogOpen(false)}
                  disabled={provisionLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold min-w-[160px]"
                  onClick={() => {
                    logInfo("Confirm Provisioning button clicked");
                    handleProvisionUser();
                  }}
                  disabled={provisionLoading}
                >
                  {provisionLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Confirm Provisioning
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md backdrop-blur-2xl shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black flex items-center gap-3">
                  <Shield className="h-6 w-6 text-indigo-400" />
                  Edit Managed Profile
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Update privileged staff details and recover credentials for
                  Police, NGO, Analyst, and Counselor accounts.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="editFullName"
                    className="text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="editFullName"
                    className="bg-slate-950 border-white/5 text-white h-12"
                    value={editForm.fullName}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        fullName: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Managed Role
                    </Label>
                    <Select
                      value={editForm.role}
                      onValueChange={(value: EditablePrivilegedRoleOption) =>
                        setEditForm((prev) => ({ ...prev, role: value }))
                      }
                    >
                      <SelectTrigger className="bg-slate-950 border-white/5 text-white h-12">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        <SelectItem value="police">Police Officer</SelectItem>
                        <SelectItem value="ngo">NGO Partner</SelectItem>
                        <SelectItem value="counselor">
                          Specialized Counselor
                        </SelectItem>
                        <SelectItem value="analyst">Data Analyst</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Approval Status
                    </Label>
                    <Select
                      value={editForm.approvalStatus}
                      onValueChange={(value: ApprovalStatusOption) =>
                        setEditForm((prev) => ({
                          ...prev,
                          approvalStatus: value,
                          isActive:
                            value === "approved" ? prev.isActive : false,
                        }))
                      }
                    >
                      <SelectTrigger className="bg-slate-950 border-white/5 text-white h-12">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {approvalStatusOptions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Affiliated Organization
                  </Label>
                  <Select
                    value={editForm.organizationId || "none"}
                    onValueChange={(value) =>
                      setEditForm((prev) => ({
                        ...prev,
                        organizationId: value === "none" ? null : value,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-slate-950 border-white/5 text-white h-12">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white max-h-60">
                      <SelectItem value="none">No Affiliation</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="editUsername"
                      className="text-xs font-black uppercase tracking-widest text-slate-500"
                    >
                      New Username
                    </Label>
                    <Input
                      id="editUsername"
                      placeholder="Leave blank to keep current"
                      className="bg-slate-950 border-white/5 text-white h-12"
                      value={editForm.username}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          username: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="editPassword"
                      className="text-xs font-black uppercase tracking-widest text-slate-500"
                    >
                      Temporary Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="editPassword"
                        type={showEditPassword ? "text" : "password"}
                        placeholder="Leave blank to keep current"
                        className="bg-slate-950 border-white/5 text-white h-12 pr-10"
                        value={editForm.password}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                      >
                        {showEditPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Account Access
                  </Label>
                  <Select
                    value={editForm.isActive ? "active" : "suspended"}
                    onValueChange={(value) =>
                      setEditForm((prev) => ({
                        ...prev,
                        isActive: value === "active",
                      }))
                    }
                    disabled={editForm.approvalStatus !== "approved"}
                  >
                    <SelectTrigger className="bg-slate-950 border-white/5 text-white h-12 disabled:opacity-60">
                      <SelectValue placeholder="Select account access" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-500">
                    Username and password are optional. Leave them empty to keep
                    the current credentials.
                  </p>
                </div>
              </div>

              <DialogFooter className="mt-6 gap-3 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={editLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold min-w-[160px]"
                  onClick={handleUpdateManagedProfile}
                  disabled={editLoading}
                >
                  {editLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isResetDialogOpen}
            onOpenChange={(open) => {
              if (open) {
                setIsResetDialogOpen(true);
                return;
              }
              closeResetDialog();
            }}
          >
            <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md backdrop-blur-2xl shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black flex items-center gap-3">
                  <KeyRound className="h-6 w-6 text-amber-400" />
                  Temporary Password Ready
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Share this password securely with{" "}
                  {resetCredentialName || "the managed account"}. It is only
                  shown once here.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  Use this temporary password for the next sign-in, then rotate
                  it again if needed.
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                    Temporary Password
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={resetCredentialPassword}
                      className="bg-slate-950 border-white/5 text-white h-12 font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 border-white/10 bg-white/5 text-white hover:bg-white/10"
                      onClick={handleCopyResetPassword}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                  onClick={closeResetDialog}
                >
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isAdminVerifyDialogOpen}
            onOpenChange={(open) => {
              if (adminVerifyLoading) {
                return;
              }
              if (!open) {
                closeAdminVerifyDialog();
                return;
              }
              setIsAdminVerifyDialogOpen(true);
            }}
          >
            <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md backdrop-blur-2xl shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-emerald-400" />
                  Confirm Admin Identity
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Re-enter your admin passphrase to{" "}
                  {pendingAdminActionLabel || "continue"}. Sensitive actions
                  stay verified for 5 minutes.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  This extra verification only applies to privileged admin
                  actions and does not affect other roles.
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="adminVerifyPassword"
                    className="text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Admin Passphrase
                  </Label>
                  <Input
                    id="adminVerifyPassword"
                    type="password"
                    className="bg-slate-950 border-white/5 text-white h-12"
                    value={adminVerifyPassword}
                    onChange={(e) => setAdminVerifyPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void handleAdminStepUpVerification();
                      }
                    }}
                  />
                </div>
                {adminVerifyError && (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                    {adminVerifyError}
                  </div>
                )}
              </div>

              <DialogFooter className="mt-6 gap-3 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  onClick={closeAdminVerifyDialog}
                  disabled={adminVerifyLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold min-w-[170px]"
                  onClick={handleAdminStepUpVerification}
                  disabled={adminVerifyLoading}
                >
                  {adminVerifyLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Verify and Continue
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {(activeSection === "overview" || activeSection === "approvals") && (
            <Card className="relative isolate overflow-hidden border-white/10 bg-slate-900/70 shadow-2xl backdrop-blur-xl">
              <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-cyan-500/12 blur-3xl" />
                <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
              <div className="p-8 border-b border-white/5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3 max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-sky-300">
                    Admin Control Brief
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Security posture, approvals, and partner readiness in one
                    view
                  </h2>
                  <p className="text-sm text-slate-300 font-medium leading-relaxed">
                    Prioritize privileged approvals, monitor schema readiness,
                    and confirm whether sensitive admin actions are currently
                    within the trusted verification window.
                  </p>
                </div>
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] ${adminAttentionItems > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  {adminAttentionItems > 0
                    ? `${adminAttentionItems} items need attention`
                    : "Control plane stable"}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 p-8 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3">
                      <Building2 className="h-5 w-5 text-blue-400" />
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${organizationsAwaitingSchemaSync > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-blue-500/20 bg-blue-500/10 text-blue-300"}`}
                    >
                      {organizationsAwaitingSchemaSync > 0
                        ? "Schema Sync Required"
                        : "Verification Live"}
                    </span>
                  </div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    Partner Network
                  </p>
                  {orgLoading ? (
                    <Skeleton className="mt-3 h-10 w-20 bg-white/5" />
                  ) : (
                    <p className="mt-3 text-4xl font-black text-white">
                      {organizations.length}
                    </p>
                  )}
                  <p className="mt-3 text-xs font-medium text-slate-400">
                    {organizationsAwaitingSchemaSync > 0
                      ? `${organizationsAwaitingSchemaSync} organizations are waiting for the verification schema migration.`
                      : `${verifiedOrganizations} verified and ${unverifiedOrganizations} pending verification.`}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3">
                      <Users className="h-5 w-5 text-indigo-400" />
                    </div>
                    <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase text-indigo-300">
                      Privileged Identities
                    </span>
                  </div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    Protected Identities
                  </p>
                  {userLoading ? (
                    <Skeleton className="mt-3 h-10 w-20 bg-white/5" />
                  ) : (
                    <p className="mt-3 text-4xl font-black text-white">
                      {protectedUsers}
                    </p>
                  )}
                  <p className="mt-3 text-xs font-medium text-slate-400">
                    {userLoading
                      ? "Loading identity posture..."
                      : `${managedPrivilegedUsers} managed specialist accounts, ${activeUsers} active, ${inactiveUsers} suspended, and ${mfaProtectedUsers}/${protectedUsers || 1} protected identities reporting MFA.`}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
                      <ShieldCheck className="h-5 w-5 text-amber-300" />
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${pendingApprovalCount > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}
                    >
                      {pendingApprovalCount > 0
                        ? "Approval Needed"
                        : "Queue Clear"}
                    </span>
                  </div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    Privileged Approval Queue
                  </p>
                  {userLoading ? (
                    <Skeleton className="mt-3 h-10 w-20 bg-white/5" />
                  ) : (
                    <p
                      className={`mt-3 text-4xl font-black ${pendingApprovalCount > 0 ? "text-amber-300" : "text-white"}`}
                    >
                      {pendingApprovalCount}
                    </p>
                  )}
                  <p className="mt-3 text-xs font-medium text-slate-400">
                    Explicit admin approval remains required before NGO, Police,
                    and Analyst workflows activate.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <KeyRound className="h-5 w-5 text-emerald-400" />
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${adminStepUpActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-slate-500/20 bg-slate-500/10 text-slate-300"}`}
                    >
                      {adminStepUpActive
                        ? "Trusted Window Active"
                        : "Step-Up Ready"}
                    </span>
                  </div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                    Sensitive Admin Actions
                  </p>
                  <p
                    className={`mt-3 text-2xl font-black ${adminStepUpActive ? "text-emerald-300" : "text-white"}`}
                  >
                    {adminStepUpActive
                      ? `${adminStepUpMinutesRemaining} min left`
                      : "Re-auth required"}
                  </p>
                  <p className="mt-3 text-xs font-medium text-slate-400">
                    {adminStepUpActive
                      ? "The next privileged admin action can proceed without another credential prompt until the trusted window expires."
                      : "Provisioning, approvals, credential resets, and revocations require admin re-verification."}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {activeSection === "overview" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="border-white/10 bg-slate-900/40 p-5 backdrop-blur-md">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3">
                    <Building2 className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Partner Verification
                    </p>
                    <p className="text-lg font-black text-white">
                      {organizationsAwaitingSchemaSync > 0
                        ? "Schema migration required"
                        : "Verification controls active"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {organizationsAwaitingSchemaSync > 0
                        ? `${organizationsAwaitingSchemaSync} organizations still need the verification schema refreshed.`
                        : `${verifiedOrganizations} verified partners are currently available to admin governance flows.`}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="border-white/10 bg-slate-900/40 p-5 backdrop-blur-md">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
                    <ShieldCheck className="h-5 w-5 text-amber-300" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Approval Discipline
                    </p>
                    <p className="text-lg font-black text-white">
                      {pendingApprovalCount > 0
                        ? `${pendingApprovalCount} requests awaiting review`
                        : "No pending privileged approvals"}
                    </p>
                    <p className="text-xs text-slate-400">
                      NGO, Police, and Analyst access remains locked until an
                      admin makes an explicit decision.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="border-white/10 bg-slate-900/40 p-5 backdrop-blur-md">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                    <KeyRound className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Admin Verification Window
                    </p>
                    <p className="text-lg font-black text-white">
                      {adminStepUpActive
                        ? `${adminStepUpMinutesRemaining} minutes remaining`
                        : "Step-up required for sensitive actions"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Credential resets, revocations, approvals, and
                      provisioning remain behind admin re-authentication.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {(activeSection === "overview" || activeSection === "approvals") && (
            <Card className="border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl overflow-hidden">
              <div className="p-8 border-b border-white/5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6 text-amber-400" />
                    Privileged Access Approval Queue
                  </h2>
                  <p className="text-sm text-slate-400 font-medium">
                    Review pending NGO, Police, and Analyst requests before they
                    can access restricted workflows.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-300">
                  {pendingApprovalCount} Pending
                </div>
              </div>

              <div className="p-0 overflow-x-auto">
                {userLoading ? (
                  <div className="p-8 space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full bg-white/5" />
                    ))}
                  </div>
                ) : pendingApprovalProfiles.length === 0 ? (
                  <div className="p-16 flex flex-col items-center justify-center text-center opacity-50">
                    <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-4" />
                    <p className="text-lg font-black text-slate-100">
                      No pending privileged access requests
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                      New NGO, Police, and Analyst requests will appear here for
                      explicit approval or decline.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/40 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                        <th className="px-8 py-5">Requester</th>
                        <th className="px-8 py-5">Requested Role</th>
                        <th className="px-8 py-5">Organization</th>
                        <th className="px-8 py-5">Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {pendingApprovalProfiles.map((item) => {
                        const selectedOrganizationId =
                          organizationAssignments[item.id] ??
                          item.organizationId ??
                          "none";
                        const requiresOrganization =
                          item.role === "ngo" || item.role === "police";

                        return (
                          <tr
                            key={item.id}
                            className="group hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full flex items-center justify-center font-black text-sm border bg-amber-500/10 border-amber-500/30 text-amber-300">
                                  {(item.fullName || "U").charAt(0)}
                                </div>
                                <div>
                                  <p className="font-black text-white">
                                    {item.fullName || "Pending Identity"}
                                  </p>
                                  <p className="text-[10px] font-mono text-slate-500 mt-0.5 tracking-tighter uppercase">
                                    {item.id}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
                                {item.role}
                              </span>
                            </td>
                            <td className="px-8 py-5 min-w-[240px]">
                              {requiresOrganization ? (
                                <Select
                                  value={selectedOrganizationId}
                                  onValueChange={(value) =>
                                    setOrganizationAssignments((current) => ({
                                      ...current,
                                      [item.id]:
                                        value === "none" ? null : value,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-10 bg-slate-950/60 border border-slate-800 text-xs font-bold text-white">
                                    <SelectValue placeholder="Assign organization" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-slate-950 text-white border-slate-800">
                                    <SelectItem value="none">
                                      Select organization
                                    </SelectItem>
                                    {organizations.map((org) => (
                                      <SelectItem key={org.id} value={org.id}>
                                        {org.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  Not required for analyst approval
                                </span>
                              )}
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleApprovalDecision(item.id, "approved")
                                  }
                                  disabled={updatingId === item.id}
                                  className="h-8 px-4 bg-emerald-600 hover:bg-emerald-500 border-transparent text-white font-black text-[10px] uppercase tracking-tighter"
                                >
                                  {updatingId === item.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Approve"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleApprovalDecision(item.id, "rejected")
                                  }
                                  disabled={updatingId === item.id}
                                  className="h-8 px-4 border-rose-500/20 text-rose-400 hover:bg-rose-500/10 font-black text-[10px] uppercase tracking-tighter"
                                >
                                  Decline
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          )}

          {(activeSection === "overview" || activeSection === "identities") && (
            <Card className="border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl overflow-hidden">
              <div className="p-8 border-b border-white/5 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                    <Shield className="h-6 w-6 text-indigo-400" />
                    Identity & Access Management
                  </h2>
                  <p className="text-sm text-slate-400 font-medium">
                    Coordinate user permissions, recover staff credentials, and
                    update managed privileged identities.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter by name, ID, or role..."
                      className="h-11 bg-slate-950/40 border-slate-800 text-white pl-10 w-64 focus:border-indigo-500/50 transition-all text-sm"
                    />
                  </div>
                  <Button
                    variant={showInactiveOnly ? "default" : "outline"}
                    onClick={() => {
                      setShowInactiveOnly(!showInactiveOnly);
                      setUserPage(0);
                    }}
                    className={`h-11 font-bold text-xs uppercase tracking-widest transition-all ${showInactiveOnly ? "bg-rose-600 hover:bg-rose-500 border-transparent" : "border-white/10 bg-white/5"}`}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    {showInactiveOnly ? "Inactive Selected" : "Show Inactive"}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 border-white/10 bg-white/5 font-bold text-xs uppercase tracking-widest"
                    onClick={() => {
                      setSearchQuery("");
                      setShowInactiveOnly(false);
                      setUserPage(0);
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>

              <div className="p-0 overflow-x-auto">
                {userLoading ? (
                  <div className="p-8 space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full bg-white/5" />
                    ))}
                  </div>
                ) : filteredProfiles.length === 0 ? (
                  <div className="p-20 flex flex-col items-center justify-center text-center opacity-40">
                    <Users className="h-12 w-12 text-slate-500 mb-4" />
                    <p className="text-lg font-black text-slate-300">
                      No identities match your search criteria
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                      Try adjusting your filters or search terms
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/40 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                        <th className="px-8 py-5">Full Name & Identity</th>
                        <th className="px-8 py-5">System Role</th>
                        <th className="px-8 py-5">Account Status</th>
                        <th className="px-8 py-5">Management Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {pagedProfiles.map((item) => (
                        <tr
                          key={item.id}
                          className="group hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div
                                className={`h-10 w-10 rounded-full flex items-center justify-center font-black text-sm border ${item.isActive ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" : "bg-slate-800 border-white/5 text-slate-500"}`}
                              >
                                {(item.fullName || "U").charAt(0)}
                              </div>
                              <div>
                                <p className="font-black text-white">
                                  {item.fullName || "Unverified Profile"}
                                </p>
                                <p className="text-[10px] font-mono text-slate-500 mt-0.5 tracking-tighter uppercase">
                                  {item.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <select
                              value={item.role as RoleOption}
                              onChange={(e) =>
                                handleRoleChange(
                                  item.id,
                                  e.target.value as RoleOption,
                                )
                              }
                              aria-label={`System role for ${item.fullName || item.id}`}
                              className="h-9 bg-slate-950/60 border border-slate-800 rounded-lg px-3 text-xs font-bold text-indigo-300 focus:border-indigo-500/50 outline-none cursor-pointer transition-all"
                              disabled={updatingId === item.id}
                            >
                              {roleOptions.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full ${item.approvalStatus === "pending" ? "bg-amber-400" : item.approvalStatus === "rejected" ? "bg-rose-500" : item.isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
                              />
                              <span
                                className={`text-[10px] font-black uppercase tracking-widest ${item.approvalStatus === "pending" ? "text-amber-300" : item.approvalStatus === "rejected" ? "text-rose-400" : item.isActive ? "text-emerald-400" : "text-rose-400"}`}
                              >
                                {item.approvalStatus === "pending"
                                  ? "Pending Approval"
                                  : item.approvalStatus === "rejected"
                                    ? "Declined"
                                    : item.isActive
                                      ? "Active / Authorized"
                                      : "Suspended / Revoked"}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditDialog(item)}
                                disabled={
                                  !editablePrivilegedRoles.has(
                                    item.role as RoleOption,
                                  ) || updatingId === item.id
                                }
                                className="h-8 px-4 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/10 font-black text-[10px] uppercase tracking-tighter transition-all disabled:opacity-40"
                              >
                                Edit Profile
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResetCredentials(item)}
                                disabled={
                                  !editablePrivilegedRoles.has(
                                    item.role as RoleOption,
                                  ) || resetLoadingId === item.id
                                }
                                className="h-8 px-4 border-amber-500/20 text-amber-300 hover:bg-amber-500/10 font-black text-[10px] uppercase tracking-tighter transition-all disabled:opacity-40"
                              >
                                {resetLoadingId === item.id ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Reset Credentials"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant={item.isActive ? "outline" : "default"}
                                onClick={() =>
                                  handleStatusToggle(item.id, !item.isActive)
                                }
                                disabled={
                                  updatingId === item.id ||
                                  item.approvalStatus === "pending"
                                }
                                className={`h-8 px-4 font-black text-[10px] uppercase tracking-tighter transition-all ${item.approvalStatus === "pending" ? "border-amber-500/20 text-amber-300 bg-amber-500/10" : item.isActive ? "border-rose-500/20 text-rose-400 hover:bg-rose-500/10" : "bg-emerald-600 hover:bg-emerald-500 border-transparent text-white"}`}
                              >
                                {updatingId === item.id ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : item.approvalStatus === "pending" ? (
                                  "Awaiting Approval"
                                ) : item.isActive ? (
                                  "Revoke Access"
                                ) : (
                                  "Restore Access"
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="p-6 bg-slate-950/20 border-t border-white/5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase text-slate-500 tracking-[0.1em]">
                    Showing {pagedProfiles.length} of {filteredProfiles.length}{" "}
                    access records
                  </p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                    Page {userPage + 1} of {totalUserPages}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setUserPage((prev) => Math.max(0, prev - 1))}
                    disabled={userPage === 0}
                    className="h-9 border-white/10 bg-white/5 font-black text-[10px] uppercase tracking-widest"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setUserPage((prev) =>
                        Math.min(totalUserPages - 1, prev + 1),
                      )
                    }
                    disabled={userPage >= totalUserPages - 1}
                    className="h-9 border-white/10 bg-white/5 font-black text-[10px] uppercase tracking-widest"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {(activeSection === "overview" || activeSection === "operations") && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* USSD Gateway Simulator */}
              <Card className="border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col">
                <div className="p-8 border-b border-white/5">
                  <div className="flex items-center gap-3 mb-2">
                    <Smartphone className="h-6 w-6 text-orange-400" />
                    <h2 className="text-xl font-black text-white">
                      Rapid Support Gateway (USSD)
                    </h2>
                  </div>
                  <p className="text-sm text-slate-400 font-medium">
                    Interactive Africa&apos;s Talking Simulator
                  </p>
                </div>

                <div className="p-8 flex-1 grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                  {/* Configuration Panel */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Secure Session ID
                        </label>
                        <Input
                          value={ussdSessionId}
                          onChange={(e) => setUssdSessionId(e.target.value)}
                          placeholder="e.g. AT-SIM-921-X"
                          className="h-12 bg-slate-950/60 border-slate-800 text-white focus:border-orange-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Verified MSISDN
                        </label>
                        <Input
                          value={ussdPhoneNumber}
                          onChange={(e) => setUssdPhoneNumber(e.target.value)}
                          placeholder="+27 00 000 0000"
                          className="h-12 bg-slate-950/60 border-slate-800 text-white focus:border-orange-500/50"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Service Code
                      </label>
                      <Input
                        value={ussdServiceCode}
                        onChange={(e) => setUssdServiceCode(e.target.value)}
                        placeholder="e.g. *384*30933#"
                        className="h-12 bg-slate-950/60 border-slate-800 text-white focus:border-orange-500/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Internal State (ussdText)
                      </label>
                      <div className="h-12 px-3 py-2 bg-slate-950/60 border border-slate-800 text-slate-400 font-mono text-sm rounded-md flex items-center overflow-x-auto whitespace-nowrap">
                        {ussdText || "Empty"}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1 h-12 border-white/10 bg-white/5 font-black text-xs uppercase tracking-widest"
                        onClick={() => {
                          setUssdSessionId(`sim-${Date.now()}`);
                          setUssdPhoneNumber("+27820000000");
                          setUssdServiceCode("*384*30933#");
                          setUssdText("");
                          setUssdResponse(null);
                        }}
                      >
                        Auto-Fill
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-12 border-white/10 bg-white/5 font-black text-xs uppercase tracking-widest hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30"
                        onClick={() => {
                          setUssdSessionId("");
                          setUssdPhoneNumber("");
                          setUssdServiceCode("");
                          setUssdText("");
                          setUssdResponse(null);
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>

                  {/* Phone UI */}
                  <div className="flex justify-center">
                    <div className="w-[320px] h-[640px] bg-slate-950 rounded-[3rem] border-[8px] border-slate-800 relative overflow-hidden shadow-2xl flex flex-col">
                      {/* Phone Notch */}
                      <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-20">
                        <div className="w-32 h-5 bg-slate-800 rounded-b-xl flex items-center justify-center gap-2">
                          <div className="w-12 h-1 rounded-full bg-slate-900"></div>
                          <div className="w-2 h-2 rounded-full bg-slate-900/80"></div>
                        </div>
                      </div>

                      <div className="flex-1 bg-slate-100 flex flex-col relative pt-8 pb-6">
                        {/* Status Bar */}
                        <div className="absolute top-1 inset-x-4 flex justify-between items-center text-[10px] text-slate-500 font-bold">
                          <span>
                            {new Date().toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <div className="flex gap-1 items-center">
                            <Activity className="w-3 h-3" />
                            <div className="h-2 w-3 border border-slate-500 rounded-[2px] flex items-center p-[1px]">
                              <div className="h-full bg-slate-500 w-[70%]"></div>
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 flex items-center justify-center p-4">
                          {!ussdResponse ? (
                            <div className="w-full text-center space-y-4">
                              <div className="text-3xl font-light text-slate-800 font-mono tracking-wider break-all px-2">
                                {ussdServiceCode || "*---#"}
                              </div>
                              <Button
                                onClick={() => handleUssdSend()}
                                disabled={
                                  ussdLoading ||
                                  !ussdServiceCode ||
                                  !ussdSessionId ||
                                  !ussdPhoneNumber
                                }
                                className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center"
                              >
                                {ussdLoading ? (
                                  <RefreshCw className="h-6 w-6 animate-spin" />
                                ) : (
                                  <Smartphone className="h-8 w-8" />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <div className="w-full max-h-full flex flex-col">
                              <div className="w-full bg-white border border-slate-300 shadow-xl rounded-sm flex flex-col overflow-hidden">
                                <div className="p-4 overflow-y-auto max-h-[350px]">
                                  <p className="whitespace-pre-wrap text-sm text-slate-800 font-medium leading-relaxed font-mono">
                                    {ussdResponse}
                                  </p>
                                </div>

                                {ussdMenuType === "CON" && (
                                  <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-3">
                                    <Input
                                      value={ussdCurrentInput}
                                      onChange={(e) =>
                                        setUssdCurrentInput(e.target.value)
                                      }
                                      placeholder="Enter your response..."
                                      className="h-10 bg-white border-slate-300 text-slate-800 font-mono focus:border-orange-500"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter")
                                          handleUssdSend(ussdCurrentInput);
                                      }}
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={() =>
                                          handleUssdSend(ussdCurrentInput)
                                        }
                                        disabled={ussdLoading}
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white"
                                      >
                                        {ussdLoading ? (
                                          <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                          "Send"
                                        )}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setUssdResponse(null);
                                          setUssdText("");
                                          setUssdCurrentInput("");
                                        }}
                                        className="flex-1 border-slate-300 text-slate-600 hover:bg-slate-100"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {ussdMenuType === "END" && (
                                  <div className="p-3 border-t border-slate-200 bg-slate-50">
                                    <Button
                                      onClick={() => {
                                        setUssdResponse(null);
                                        setUssdText("");
                                        setUssdCurrentInput("");
                                      }}
                                      className="w-full bg-slate-800 hover:bg-slate-700 text-white"
                                    >
                                      Dismiss
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Organization Ecosystem */}
              <Card className="border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col">
                <div className="p-8 border-b border-white/5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                      <Building2 className="h-6 w-6 text-emerald-400" />
                      Global Partner Ecosystem
                    </h2>
                    <p className="text-sm text-slate-400 font-medium">
                      Coordinate verified NGO and Government agency status.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] ${organizationsAwaitingSchemaSync > 0 ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}
                    >
                      <Database className="h-3.5 w-3.5" />
                      {organizationsAwaitingSchemaSync > 0
                        ? "Verification Schema Pending"
                        : "Verification Controls Live"}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-emerald-400 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500/10"
                      onClick={() => void refetchOrganizations()}
                    >
                      Refresh Partners
                    </Button>
                  </div>
                </div>
                <div className="p-8 space-y-4 flex-1">
                  {organizationsAwaitingSchemaSync > 0 && (
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                      Run the latest Supabase migration to restore live partner
                      verification toggles. Until then, verification controls
                      remain read-only to avoid failed admin actions.
                    </div>
                  )}
                  {orgLoading ? (
                    [...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full bg-white/5" />
                    ))
                  ) : organizations.length === 0 ? (
                    <div className="p-12 text-center opacity-30">
                      <Building2 className="h-10 w-10 mx-auto mb-3" />
                      <p className="text-xs font-black uppercase tracking-widest">
                        No partners registered
                      </p>
                    </div>
                  ) : (
                    pagedOrganizations.map((org) => (
                      <div
                        key={org.id}
                        className="group p-5 rounded-2xl bg-slate-950/40 border border-white/5 flex items-center justify-between gap-4 hover:border-emerald-500/20 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-12 w-12 rounded-xl flex items-center justify-center border ${org.isVerified ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-white/5 text-slate-500"}`}
                          >
                            <ShieldCheck className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-black text-white">{org.name}</p>
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-tight mt-0.5">
                              {org.type} • {org.country}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 px-3 font-black text-[9px] uppercase tracking-tighter transition-all ${
                              org.supportsVerification
                                ? org.isVerified
                                  ? "border-rose-500/20 text-rose-400 hover:bg-rose-500/10"
                                  : "bg-emerald-600 hover:bg-emerald-500 border-transparent text-white"
                                : "border-amber-500/20 text-amber-300 bg-amber-500/5 hover:bg-amber-500/5"
                            }`}
                            onClick={() =>
                              handleOrgVerificationToggle(
                                org.id,
                                !org.isVerified,
                              )
                            }
                            disabled={
                              updatingId === org.id || !org.supportsVerification
                            }
                          >
                            {updatingId === org.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : org.supportsVerification ? (
                              org.isVerified ? (
                                "Revoke Status"
                              ) : (
                                "Verify Partner"
                              )
                            ) : (
                              "Sync Verification Schema"
                            )}
                          </Button>
                          <span className="ml-auto inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-300">
                            {org.supportsVerification
                              ? org.isVerified
                                ? "Trusted partner"
                                : "Pending verification"
                              : "Migration required"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-6 bg-slate-950/20 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500">
                    Page {orgPage + 1} of {totalOrgPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setOrgPage((p) => Math.max(0, p - 1))}
                      disabled={orgPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        setOrgPage((p) => Math.min(totalOrgPages - 1, p + 1))
                      }
                      disabled={orgPage >= totalOrgPages - 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {(activeSection === "overview" || activeSection === "compliance") && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
              {/* Audit & Activity Log */}
              <Card className="border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col min-h-[600px]">
                <div className="p-8 border-b border-white/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <Clock className="h-6 w-6 text-indigo-400" />
                        System Audit Stream
                      </h2>
                      <p className="text-sm text-slate-400 font-medium">
                        Immutable record of all administrative & system events.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/10 font-black text-[10px] uppercase tracking-widest"
                        onClick={handleExportAuditCsv}
                        disabled={filteredAuditLogs.length === 0}
                        title="Export filtered audit logs as CSV"
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Export CSV
                      </Button>
                      <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Activity className="h-5 w-5 text-indigo-400" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <Input
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        placeholder="Search logs..."
                        className="h-10 bg-slate-950/40 border-slate-800 text-white pl-10 text-xs"
                      />
                    </div>
                    <Select
                      value={auditSeverity}
                      onValueChange={setAuditSeverity}
                    >
                      <SelectTrigger className="w-32 h-10 bg-slate-950/40 border-slate-800 text-white text-xs">
                        <SelectValue placeholder="Severity" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-0 scrollbar-hide">
                  {auditLoading ? (
                    <div className="p-8 space-y-4">
                      {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full bg-white/5" />
                      ))}
                    </div>
                  ) : filteredAuditLogs.length === 0 ? (
                    <div className="p-20 text-center opacity-30">
                      <FileText className="h-10 w-10 mx-auto mb-3" />
                      <p className="text-xs font-black uppercase tracking-widest">
                        No audit logs found
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {filteredAuditLogs.map((log, index) => (
                        <div
                          key={`${log.time}-${log.action}-${log.user ?? "system"}-${index}`}
                          className="p-4 hover:bg-white/[0.02] transition-colors flex items-start gap-4"
                        >
                          <div
                            className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                              log.severity === "critical"
                                ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                                : log.severity === "error"
                                  ? "bg-orange-500"
                                  : log.severity === "warning"
                                    ? "bg-amber-500"
                                    : "bg-indigo-500"
                            }`}
                          />
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-black text-white truncate">
                                {log.action}
                              </p>
                              <span className="text-[9px] font-mono text-slate-500 shrink-0 uppercase tracking-tighter">
                                {new Date(log.time).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 line-clamp-1">
                              {log.description ||
                                "System intervention protocol initiated."}
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400/70">
                                {log.module}
                              </span>
                              <span className="text-[9px] text-slate-600">
                                •
                              </span>
                              <span className="text-[9px] font-medium text-slate-500 truncate max-w-[120px]">
                                {log.user || "System"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              {/* Deletion & Privacy Requests */}
              <Card className="border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col min-h-[600px]">
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                      <Trash2 className="h-6 w-6 text-rose-400" />
                      Privacy & Data Rights
                    </h2>
                    <p className="text-sm text-slate-400 font-medium">
                      Coordinate "Right to be Forgotten" deletion requests.
                    </p>
                  </div>
                  {pendingRequests > 0 && (
                    <div className="bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30">
                      <span className="text-[10px] font-black uppercase text-rose-400">
                        {pendingRequests} Pending
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-4">
                  {deletionLoading ? (
                    [...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full bg-white/5" />
                    ))
                  ) : deletionRequests.length === 0 ? (
                    <div className="p-20 text-center opacity-30 h-full flex flex-col items-center justify-center">
                      <ShieldCheck className="h-12 w-12 mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest">
                        Compliance standards met
                      </p>
                      <p className="text-[10px] mt-2 text-slate-500">
                        No pending deletion requests in queue.
                      </p>
                    </div>
                  ) : (
                    deletionRequests.map((request) => (
                      <div
                        key={request.id}
                        className={`group p-6 rounded-2xl border transition-all ${
                          request.status === "pending"
                            ? "bg-slate-950/60 border-rose-500/20 hover:border-rose-500/40"
                            : "bg-slate-950/20 border-white/5 opacity-60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-4">
                            <div
                              className={`p-3 rounded-xl ${request.status === "pending" ? "bg-rose-500/10 text-rose-400" : "bg-slate-800 text-slate-500"}`}
                            >
                              <Database className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-black text-white text-sm">
                                Target Identity: {request.userId.slice(0, 8)}...
                              </p>
                              <p className="text-[10px] font-black uppercase text-slate-500 tracking-tighter mt-0.5">
                                Requested{" "}
                                {new Date(
                                  request.requestedAt,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {request.status === "pending" ? (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[9px] font-black uppercase border border-rose-500/30">
                              <AlertTriangle className="h-3 w-3" /> Urgent
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" /> Processed
                            </span>
                          )}
                        </div>

                        <div className="mb-6 p-4 rounded-xl bg-slate-900/40 border border-white/5">
                          <p className="text-[10px] font-black uppercase text-slate-600 mb-1 tracking-widest">
                            Reason for request
                          </p>
                          <p className="text-xs text-slate-300 italic leading-relaxed">
                            "
                            {request.reason ||
                              "No specific reason provided by subject."}
                            "
                          </p>
                        </div>

                        {request.status === "pending" && (
                          <div className="flex gap-3">
                            <Button
                              onClick={() =>
                                handleProcessDeletionRequest(request.id)
                              }
                              disabled={updatingId === request.id}
                              className="flex-1 h-10 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-rose-900/20"
                            >
                              {updatingId === request.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                "Mark as Processed"
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              className="h-10 border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest"
                              onClick={() => {
                                setActiveSection("compliance");
                                setAuditSearch(request.userId.slice(0, 8));
                              }}
                            >
                              Audit Trail
                            </Button>
                          </div>
                        )}
                        {request.status === "processed" && (
                          <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                            <Clock className="h-3 w-3" />
                            Processed on{" "}
                            {new Date(request.processedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminConsole;
