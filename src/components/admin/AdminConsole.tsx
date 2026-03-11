import { useEffect, useMemo, useState } from "react";
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
  getErrorMessage
} from "@/data/aegisData";
import { useAuth } from "@/hooks/use-auth";
import { createUsernameUser, supabase } from "@/lib/supabase";
import { logError, logInfo } from "@/lib/logger";
import { useAppStore } from "@/store/appStore";
import { toast } from "sonner";
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
  MoreVertical,
  Activity,
  UserPlus,
  RefreshCw,
  Clock,
  ExternalLink,
  Shield,
  Eye,
  EyeOff,
  AlertTriangle,
  Database,
  CheckCircle2,
  FileText
} from "lucide-react";

const roleOptions = ["admin", "counselor", "analyst", "ngo", "police", "survivor"] as const;

type RoleOption = typeof roleOptions[number];

const AdminConsole: React.FC = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.id);
  const isAdmin = profile?.role === "admin";
  const { setActiveModule } = useAppStore();
  
  const { data: organizations = [], isLoading: orgLoading } = useOrganizations({ enabled: isAdmin, limit: 100, staleTime: 60000 });
  const { data: users = [], isLoading: userLoading, refetch: refetchUsers } = useUserProfiles({ enabled: isAdmin, limit: 200, staleTime: 60000 });
  const { data: deletionRequests = [], isLoading: deletionLoading } = useDeletionRequests({ enabled: isAdmin, staleTime: 30000, refetchInterval: 60000 });
  const { data: auditLogs = [], isLoading: auditLoading } = useAuditLogs({ enabled: isAdmin, limit: 100 });
  
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [userPage, setUserPage] = useState(0);
  const [orgPage, setOrgPage] = useState(0);
  
  const [ussdSessionId, setUssdSessionId] = useState("");
  const [ussdPhoneNumber, setUssdPhoneNumber] = useState("");
  const [ussdText, setUssdText] = useState("");
  const [ussdResponse, setUssdResponse] = useState<string | null>(null);
  const [ussdLoading, setUssdLoading] = useState(false);

  // Provisioning state
  const [isProvisionDialogOpen, setIsProvisionDialogOpen] = useState(false);
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [showProvisionPassword, setShowProvisionPassword] = useState(false);
  const [provisionForm, setProvisionForm] = useState({
    fullName: "",
    username: "",
    role: "counselor" as RoleOption,
    password: "",
    organizationId: "" as string | null
  });

  // Audit state
  const [auditSearch, setAuditSearch] = useState("");
  const [auditSeverity, setAuditSeverity] = useState<string>("all");
  
  const usersPerPage = 10;
  const orgsPerPage = 5;

  const activeOrgs = useMemo(() => organizations.filter((org) => org.isVerified).length, [organizations]);
  const activeUsers = useMemo(() => users.filter((u) => u.isActive).length, [users]);
  const inactiveUsers = useMemo(() => users.filter((u) => !u.isActive).length, [users]);
  const pendingRequests = useMemo(() => deletionRequests.filter((r) => r.status !== "processed").length, [deletionRequests]);

  const filteredProfiles = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    let results = users;
    if (normalized) {
      results = results.filter((item) =>
        item.fullName?.toLowerCase().includes(normalized) ||
        item.role.toLowerCase().includes(normalized) ||
        item.id.toLowerCase().includes(normalized)
      );
    }
    if (showInactiveOnly) {
      results = results.filter((item) => !item.isActive);
    }
    return results;
  }, [users, searchQuery, showInactiveOnly]);

  const filteredAuditLogs = useMemo(() => {
    let logs = auditLogs;
    if (auditSearch) {
      const search = auditSearch.toLowerCase();
      logs = logs.filter(log => 
        log.action.toLowerCase().includes(search) || 
        log.description?.toLowerCase().includes(search) ||
        log.user?.toLowerCase().includes(search)
      );
    }
    if (auditSeverity !== "all") {
      logs = logs.filter(log => log.severity === auditSeverity);
    }
    return logs;
  }, [auditLogs, auditSearch, auditSeverity]);

  const totalUserPages = Math.max(1, Math.ceil(filteredProfiles.length / usersPerPage));
  const pagedProfiles = useMemo(
    () => filteredProfiles.slice(userPage * usersPerPage, userPage * usersPerPage + usersPerPage),
    [filteredProfiles, userPage, usersPerPage]
  );

  const totalOrgPages = Math.max(1, Math.ceil(organizations.length / orgsPerPage));
  const pagedOrganizations = useMemo(
    () => organizations.slice(orgPage * orgsPerPage, orgPage * orgsPerPage + orgsPerPage),
    [organizations, orgPage, orgsPerPage]
  );

  useEffect(() => {
    if (userPage > totalUserPages - 1) setUserPage(Math.max(0, totalUserPages - 1));
  }, [totalUserPages, userPage]);

  useEffect(() => {
    if (orgPage > totalOrgPages - 1) setOrgPage(Math.max(0, totalOrgPages - 1));
  }, [totalOrgPages, orgPage]);

  const handleRoleChange = async (userId: string, nextRole: RoleOption) => {
    if (!isAdmin) return;
    setUpdatingId(userId);
    const { error } = await supabase
      .from("user_profiles")
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
    setUpdatingId(null);
  };

  const handleStatusToggle = async (userId: string, nextStatus: boolean) => {
    if (!isAdmin) return;
    setUpdatingId(userId);
    const { error } = await supabase
      .from("user_profiles")
      .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", userId);
    
    if (error) {
      logError(error, { source: "admin.status_update", userId, nextStatus });
      toast.error("Failed to update status");
    } else {
      logInfo("Status updated", { userId, nextStatus });
      toast.success(`Account ${nextStatus ? 'activated' : 'suspended'} successfully`);
      refetchUsers();
    }
    setUpdatingId(null);
  };

  const handleProvisionUser = async () => {
    logInfo("Attempting to provision user", { isAdmin, provisionForm });
    
    // Proactive session check to prevent "Invalid Refresh Token" errors during provisioning
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      logError(sessionError || new Error("No active session found"), { source: "admin.session_check" });
      toast.error("Your session has expired. Please log out and log back in.");
      return;
    }

    if (!isAdmin) {
      toast.error("Unauthorized: Admin privileges required to provision accounts");
      return;
    }

    if (!provisionForm.fullName || !provisionForm.username || !provisionForm.password) {
      toast.error("Please fill in all required fields (Full Name, Username, and Password)");
      return;
    }

    const usernamePattern = /^[a-zA-Z0-9._-]{3,24}$/;
    if (!usernamePattern.test(provisionForm.username.trim())) {
      toast.error("Invalid username format. Use 3-24 characters (letters, numbers, dots, underscores, or hyphens)");
      return;
    }

    if (provisionForm.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setProvisionLoading(true);
    try {
      logInfo("Invoking create_username_user Edge Function");
      // 1. Create the Auth user via Edge Function
      const { data: createData, error: createError } = await createUsernameUser({
        username: provisionForm.username.trim(),
        password: provisionForm.password,
        full_name: provisionForm.fullName.trim(),
      });

      if (createError || createData?.success === false) {
        logError(createError || new Error(createData?.error), { source: "admin.provision_user.edge_function", createData });
        throw new Error(createData?.error || createError?.message || "Failed to create authentication record");
      }

      const userId = createData.user_id;
      logInfo("Auth user created", { userId });

      // 2. Create the User Profile
      logInfo("Upserting user profile", { userId, role: provisionForm.role });
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert({
          id: userId,
          role: provisionForm.role,
          full_name: provisionForm.fullName.trim(),
          is_active: true,
          organization_id: provisionForm.organizationId || null,
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        logError(profileError, { source: "admin.provision_user.profile_upsert", userId });
        throw profileError;
      }

      toast.success(`Account provisioned successfully for ${provisionForm.fullName}`);
      setIsProvisionDialogOpen(false);
      setProvisionForm({
        fullName: "",
        username: "",
        role: "counselor",
        password: "",
        organizationId: null
      });
      refetchUsers();
    } catch (err) {
      const message = getErrorMessage(err);
      logError(err, { source: "admin.provision_user" });
      
      // Ensure we pass a string to toast
      const toastMessage = typeof message === 'string' ? message : "An unexpected error occurred during provisioning";
      toast.error(`Provisioning failed: ${toastMessage}`);
    } finally {
      setProvisionLoading(false);
    }
  };

  const handleOrgVerificationToggle = async (orgId: string, nextStatus: boolean) => {
    if (!isAdmin) return;
    setUpdatingId(orgId);
    const { error } = await supabase
      .from("organizations")
      .update({ is_verified: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", orgId);
    
    if (error) {
      logError(error, { source: "admin.org_verify", orgId, nextStatus });
      toast.error("Failed to update organization status");
    } else {
      logInfo("Organization status updated", { orgId, nextStatus });
      toast.success(`Organization ${nextStatus ? 'verified' : 'revoked'} successfully`);
    }
    setUpdatingId(null);
  };

  const handleProcessDeletionRequest = async (requestId: string) => {
    if (!isAdmin) return;
    setUpdatingId(requestId);
    const { error } = await supabase
      .from("data_deletion_requests")
      .update({ 
        status: "processed", 
        processed_at: new Date().toISOString(),
        processed_by: user?.id
      })
      .eq("id", requestId);
    
    if (error) {
      logError(error, { source: "admin.deletion_process", requestId });
      toast.error("Failed to process deletion request");
    } else {
      logInfo("Deletion request processed", { requestId });
      toast.success("Request marked as processed");
    }
    setUpdatingId(null);
  };

  const handleUssdSend = async () => {
    if (!isAdmin) return;
    if (!ussdSessionId.trim() || !ussdPhoneNumber.trim()) {
      setUssdResponse("Session ID and phone number are required.");
      return;
    }
    setUssdLoading(true);
    setUssdResponse(null);
    try {
      const { data, error } = await supabase.functions.invoke("ussd-handler", {
        body: { sessionId: ussdSessionId.trim(), phoneNumber: ussdPhoneNumber.trim(), text: ussdText.trim() },
      });
      if (error) throw error;
      setUssdResponse(data?.response ?? "No response returned.");
    } catch (err) {
      logError(err, { source: "admin.ussd" });
      setUssdResponse("Failed to connect to USSD gateway.");
    } finally {
      setUssdLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#050810] text-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-500">Verifying Security Credentials...</p>
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
            Your current security clearance level is insufficient to access the Enterprise Control Hub. 
            This attempt has been logged.
          </p>
          <Button 
            className="w-full h-12 bg-white text-black hover:bg-slate-200 font-black uppercase tracking-widest"
            onClick={() => setActiveModule("dashboard")}
          >
            Return to Safety
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050810] text-slate-50 px-6 py-8 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 relative z-10">
        {/* Header Section */}
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between bg-slate-900/40 p-8 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Users className="h-5 w-5 text-indigo-400" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400">Enterprise Control Hub</p>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white lg:text-5xl">Admin Console</h1>
            <p className="text-lg text-slate-400/90 max-w-2xl font-light">
              Full oversight of organizations, identities, and zero-trust access protocols within the AEGIS ecosystem.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" variant="outline" className="h-14 border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold transition-all hover:scale-105" onClick={() => setActiveModule("dashboard")}>
              <ChevronLeft className="mr-2 h-5 w-5 text-indigo-400" />
              Return to Dashboard
            </Button>
            <Button 
              size="lg" 
              className="h-14 bg-indigo-600 hover:bg-indigo-600/90 text-white shadow-xl shadow-indigo-900/20 font-bold transition-all hover:scale-105"
              onClick={() => setIsProvisionDialogOpen(true)}
            >
              <UserPlus className="mr-2 h-5 w-5" />
              Provision Account
            </Button>
          </div>
        </header>

        {/* Provisioning Dialog */}
        <Dialog open={isProvisionDialogOpen} onOpenChange={setIsProvisionDialogOpen}>
          <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md backdrop-blur-2xl shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black flex items-center gap-3">
                <UserPlus className="h-6 w-6 text-indigo-400" />
                Provision Specialized Account
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Create authenticated credentials for specialized platform roles.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-xs font-black uppercase tracking-widest text-slate-500">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Enter full legal name"
                  className="bg-slate-950 border-white/5 text-white h-12"
                  value={provisionForm.fullName}
                  onChange={(e) => setProvisionForm(prev => ({ ...prev, fullName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs font-black uppercase tracking-widest text-slate-500">Username (Identifier)</Label>
                <div className="relative">
                  <Input
                    id="username"
                    placeholder="e.g. officer.smith"
                    className="bg-slate-950 border-white/5 text-white h-12"
                    value={provisionForm.username}
                    onChange={(e) => setProvisionForm(prev => ({ ...prev, username: e.target.value }))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-600 uppercase">@aegis.systems</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Account Role</Label>
                  <Select 
                    value={provisionForm.role} 
                    onValueChange={(val: RoleOption) => setProvisionForm(prev => ({ ...prev, role: val }))}
                  >
                    <SelectTrigger className="bg-slate-950 border-white/5 text-white h-12">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      <SelectItem value="police">Police Officer</SelectItem>
                      <SelectItem value="ngo">NGO Partner</SelectItem>
                      <SelectItem value="counselor">Specialized Counselor</SelectItem>
                      <SelectItem value="analyst">Data Analyst</SelectItem>
                      <SelectItem value="admin">System Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-black uppercase tracking-widest text-slate-500">Initial Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showProvisionPassword ? "text" : "password"}
                      className="bg-slate-950 border-white/5 text-white h-12 pr-10"
                      value={provisionForm.password}
                      onChange={(e) => setProvisionForm(prev => ({ ...prev, password: e.target.value }))}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowProvisionPassword(!showProvisionPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                    >
                      {showProvisionPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Affiliated Organization</Label>
                <Select 
                  value={provisionForm.organizationId || "none"} 
                  onValueChange={(val) => setProvisionForm(prev => ({ ...prev, organizationId: val === "none" ? null : val }))}
                >
                  <SelectTrigger className="bg-slate-950 border-white/5 text-white h-12">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white max-h-60">
                    <SelectItem value="none">No Affiliation</SelectItem>
                    {organizations.map(org => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
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

        {/* Global Key Metrics */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="group border-white/10 bg-slate-900/40 p-6 backdrop-blur-md transition-all hover:border-blue-500/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                <Building2 className="h-6 w-6 text-blue-400" />
              </div>
              <span className="bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase text-blue-400 border border-blue-500/20 rounded-full">Global Network</span>
            </div>
            <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">Organizations</h3>
            {orgLoading ? <Skeleton className="h-10 w-16 bg-white/5 mt-2" /> : <p className="text-4xl font-black text-white">{activeOrgs}</p>}
            <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-tighter">{organizations.length} total registered</p>
          </Card>

          <Card className="group border-white/10 bg-slate-900/40 p-6 backdrop-blur-md transition-all hover:border-indigo-500/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
                <Users className="h-6 w-6 text-indigo-400" />
              </div>
              <span className="bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase text-indigo-400 border border-indigo-500/20 rounded-full">Active Staff</span>
            </div>
            <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">Identity Access</h3>
            {userLoading ? <Skeleton className="h-10 w-16 bg-white/5 mt-2" /> : <p className="text-4xl font-black text-white">{activeUsers}</p>}
            <p className="text-[10px] text-indigo-500 mt-2 font-bold uppercase tracking-tighter">{inactiveUsers} accounts suspended</p>
          </Card>

          <Card className="group border-white/10 bg-slate-900/40 p-6 backdrop-blur-md transition-all hover:border-rose-500/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 group-hover:bg-rose-500/20 transition-colors">
                <Trash2 className="h-6 w-6 text-rose-400" />
              </div>
              <span className={`${pendingRequests > 0 ? "bg-rose-500/20 text-rose-400 border-rose-500/30" : "bg-slate-500/10 text-slate-400 border-white/10"} px-3 py-1 text-[10px] font-black uppercase border rounded-full`}>
                {pendingRequests} Active
              </span>
            </div>
            <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">Deletion Requests</h3>
            {deletionLoading ? <Skeleton className="h-10 w-16 bg-white/5 mt-2" /> : <p className={`text-4xl font-black ${pendingRequests > 0 ? "text-rose-400" : "text-white"}`}>{pendingRequests}</p>}
            <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-tighter">Right to be forgotten queue</p>
          </Card>

          <Card className="group border-white/10 bg-slate-900/40 p-6 backdrop-blur-md transition-all hover:border-emerald-500/30">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <span className="bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase text-emerald-400 border border-emerald-500/20 rounded-full">Compliance</span>
            </div>
            <h3 className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">System Health</h3>
            <p className="text-4xl font-black text-white">100%</p>
            <p className="text-[10px] text-emerald-500 mt-2 font-bold uppercase tracking-tighter">Audit trails fully encrypted</p>
          </Card>
        </div>

        {/* Identity Management Section */}
        <Card className="border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="p-8 border-b border-white/5 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                <Shield className="h-6 w-6 text-indigo-400" />
                Identity & Access Management
              </h2>
              <p className="text-sm text-slate-400 font-medium">Coordinate user permissions across all service tiers.</p>
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
                onClick={() => { setShowInactiveOnly(!showInactiveOnly); setUserPage(0); }}
                className={`h-11 font-bold text-xs uppercase tracking-widest transition-all ${showInactiveOnly ? "bg-rose-600 hover:bg-rose-500 border-transparent" : "border-white/10 bg-white/5"}`}
              >
                <Filter className="mr-2 h-4 w-4" />
                {showInactiveOnly ? "Inactive Selected" : "Show Inactive"}
              </Button>
              <Button variant="outline" className="h-11 border-white/10 bg-white/5 font-bold text-xs uppercase tracking-widest" onClick={() => setSearchQuery("")}>
                Clear
              </Button>
            </div>
          </div>

          <div className="p-0 overflow-x-auto">
            {userLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full bg-white/5" />)}
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="p-20 flex flex-col items-center justify-center text-center opacity-40">
                <Users className="h-12 w-12 text-slate-500 mb-4" />
                <p className="text-lg font-black text-slate-300">No identities match your search criteria</p>
                <p className="text-sm text-slate-500 mt-2">Try adjusting your filters or search terms</p>
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
                    <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-black text-sm border ${item.isActive ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" : "bg-slate-800 border-white/5 text-slate-500"}`}>
                            {(item.fullName || "U").charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-white">{item.fullName || "Unverified Profile"}</p>
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5 tracking-tighter uppercase">{item.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <select
                          value={item.role as RoleOption}
                          onChange={(e) => handleRoleChange(item.id, e.target.value as RoleOption)}
                          className="h-9 bg-slate-950/60 border border-slate-800 rounded-lg px-3 text-xs font-bold text-indigo-300 focus:border-indigo-500/50 outline-none cursor-pointer transition-all"
                          disabled={updatingId === item.id}
                        >
                          {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                        </select>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${item.isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${item.isActive ? "text-emerald-400" : "text-rose-400"}`}>
                            {item.isActive ? "Active / Authorized" : "Suspended / Revoked"}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={item.isActive ? "outline" : "default"}
                            onClick={() => handleStatusToggle(item.id, !item.isActive)}
                            disabled={updatingId === item.id}
                            className={`h-8 px-4 font-black text-[10px] uppercase tracking-tighter transition-all ${item.isActive ? "border-rose-500/20 text-rose-400 hover:bg-rose-500/10" : "bg-emerald-600 hover:bg-emerald-500 border-transparent text-white"}`}
                          >
                            {updatingId === item.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : item.isActive ? "Revoke Access" : "Restore Access"}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white hover:bg-white/5 transition-all">
                            <MoreVertical className="h-4 w-4" />
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
            <p className="text-xs font-black uppercase text-slate-500 tracking-[0.1em]">
              Showing {pagedProfiles.length} of {filteredProfiles.length} verified records
            </p>
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
              <div className="flex items-center gap-1.5 px-3">
                {[...Array(totalUserPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setUserPage(i)}
                    className={`h-1.5 w-6 rounded-full transition-all ${userPage === i ? "bg-indigo-500" : "bg-white/10 hover:bg-white/20"}`}
                  />
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setUserPage((prev) => Math.min(totalUserPages - 1, prev + 1))}
                disabled={userPage >= totalUserPages - 1}
                className="h-9 border-white/10 bg-white/5 font-black text-[10px] uppercase tracking-widest"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* USSD Gateway Simulator */}
          <Card className="border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-white/5">
              <div className="flex items-center gap-3 mb-2">
                <Smartphone className="h-6 w-6 text-orange-400" />
                <h2 className="text-xl font-black text-white">Rapid Support Gateway (USSD)</h2>
              </div>
              <p className="text-sm text-slate-400 font-medium">Verify system response for offline rapid-response protocols.</p>
            </div>
            <div className="p-8 space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Secure Session ID</label>
                  <Input
                    value={ussdSessionId}
                    onChange={(e) => setUssdSessionId(e.target.value)}
                    placeholder="e.g. SES-921-X"
                    className="h-12 bg-slate-950/60 border-slate-800 text-white focus:border-orange-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Verified MSISDN</label>
                  <Input
                    value={ussdPhoneNumber}
                    onChange={(e) => setUssdPhoneNumber(e.target.value)}
                    placeholder="+27 00 000 0000"
                    className="h-12 bg-slate-950/60 border-slate-800 text-white focus:border-orange-500/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Input Command String</label>
                <Input
                  value={ussdText}
                  onChange={(e) => setUssdText(e.target.value)}
                  placeholder="e.g. 1*Gauteng*JHB*SOS"
                  className="h-12 bg-slate-950/60 border-slate-800 text-white focus:border-orange-500/50"
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleUssdSend} disabled={ussdLoading} className="flex-1 h-12 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-widest shadow-lg shadow-orange-900/20">
                  {ussdLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : "Invoke Gateway"}
                </Button>
                <Button variant="outline" className="h-12 border-white/10 bg-white/5 font-black text-xs uppercase tracking-widest" onClick={() => { setUssdSessionId(""); setUssdPhoneNumber(""); setUssdText(""); setUssdResponse(null); }}>
                  Reset
                </Button>
              </div>
              <div className="mt-4 p-5 rounded-2xl bg-slate-950/60 border border-white/5 relative min-h-[120px]">
                <div className="absolute top-0 right-0 p-3">
                  <Activity className="h-4 w-4 text-orange-500/30" />
                </div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 block mb-2">Gateway Response Payload</label>
                <p className="text-sm font-mono text-orange-200/90 leading-relaxed italic">
                  {ussdResponse || "Awaiting gateway invocation..."}
                </p>
              </div>
            </div>
          </Card>

          {/* Organization Ecosystem */}
          <Card className="border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-white flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-emerald-400" />
                  Global Partner Ecosystem
                </h2>
                <p className="text-sm text-slate-400 font-medium">Coordinate verified NGO and Government agency status.</p>
              </div>
              <Button size="sm" variant="ghost" className="text-emerald-400 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500/10">View Network Map</Button>
            </div>
            <div className="p-8 space-y-4 flex-1">
              {orgLoading ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full bg-white/5" />)
              ) : organizations.length === 0 ? (
                <div className="p-12 text-center opacity-30">
                  <Building2 className="h-10 w-10 mx-auto mb-3" />
                  <p className="text-xs font-black uppercase tracking-widest">No partners registered</p>
                </div>
              ) : (
                pagedOrganizations.map((org) => (
                  <div key={org.id} className="group p-5 rounded-2xl bg-slate-950/40 border border-white/5 flex items-center justify-between gap-4 hover:border-emerald-500/20 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${org.isVerified ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-800 border-white/5 text-slate-500"}`}>
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-black text-white">{org.name}</p>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-tight mt-0.5">{org.type} • {org.country}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className={`h-8 px-3 font-black text-[9px] uppercase tracking-tighter transition-all ${org.isVerified ? "border-rose-500/20 text-rose-400 hover:bg-rose-500/10" : "bg-emerald-600 hover:bg-emerald-500 border-transparent text-white"}`}
                        onClick={() => handleOrgVerificationToggle(org.id, !org.isVerified)}
                        disabled={updatingId === org.id}
                      >
                        {updatingId === org.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : org.isVerified ? "Revoke Status" : "Verify Partner"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 border border-white/5 hover:border-white/10 ml-auto">
                        <ExternalLink className="h-3 w-3 text-slate-500" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-6 bg-slate-950/20 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-500">Page {orgPage + 1} of {totalOrgPages}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setOrgPage(p => Math.max(0, p - 1))} disabled={orgPage === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setOrgPage(p => Math.min(totalOrgPages - 1, p + 1))} disabled={orgPage >= totalOrgPages - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Governance & Compliance Hub */}
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
                  <p className="text-sm text-slate-400 font-medium">Immutable record of all administrative & system events.</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-indigo-400" />
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
                <Select value={auditSeverity} onValueChange={setAuditSeverity}>
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
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full bg-white/5" />)}
                </div>
              ) : filteredAuditLogs.length === 0 ? (
                <div className="p-20 text-center opacity-30">
                  <FileText className="h-10 w-10 mx-auto mb-3" />
                  <p className="text-xs font-black uppercase tracking-widest">No audit logs found</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredAuditLogs.map((log, idx) => (
                    <div key={idx} className="p-4 hover:bg-white/[0.02] transition-colors flex items-start gap-4">
                      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                        log.severity === "critical" ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" : 
                        log.severity === "error" ? "bg-orange-500" : 
                        log.severity === "warning" ? "bg-amber-500" : "bg-indigo-500"
                      }`} />
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-white truncate">{log.action}</p>
                          <span className="text-[9px] font-mono text-slate-500 shrink-0 uppercase tracking-tighter">
                            {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1">{log.description || "System intervention protocol initiated."}</p>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400/70">{log.module}</span>
                          <span className="text-[9px] text-slate-600">•</span>
                          <span className="text-[9px] font-medium text-slate-500 truncate max-w-[120px]">{log.user || "System"}</span>
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
                <p className="text-sm text-slate-400 font-medium">Coordinate "Right to be Forgotten" deletion requests.</p>
              </div>
              {pendingRequests > 0 && (
                <div className="bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30">
                  <span className="text-[10px] font-black uppercase text-rose-400">{pendingRequests} Pending</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-4">
              {deletionLoading ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full bg-white/5" />)
              ) : deletionRequests.length === 0 ? (
                <div className="p-20 text-center opacity-30 h-full flex flex-col items-center justify-center">
                  <ShieldCheck className="h-12 w-12 mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest">Compliance standards met</p>
                  <p className="text-[10px] mt-2 text-slate-500">No pending deletion requests in queue.</p>
                </div>
              ) : (
                deletionRequests.map((request) => (
                  <div key={request.id} className={`group p-6 rounded-2xl border transition-all ${
                    request.status === "pending" 
                      ? "bg-slate-950/60 border-rose-500/20 hover:border-rose-500/40" 
                      : "bg-slate-950/20 border-white/5 opacity-60"
                  }`}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${request.status === "pending" ? "bg-rose-500/10 text-rose-400" : "bg-slate-800 text-slate-500"}`}>
                          <Database className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-black text-white text-sm">Target Identity: {request.userId.slice(0, 8)}...</p>
                          <p className="text-[10px] font-black uppercase text-slate-500 tracking-tighter mt-0.5">
                            Requested {new Date(request.requestedAt).toLocaleDateString()}
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
                      <p className="text-[10px] font-black uppercase text-slate-600 mb-1 tracking-widest">Reason for request</p>
                      <p className="text-xs text-slate-300 italic leading-relaxed">
                        "{request.reason || "No specific reason provided by subject."}"
                      </p>
                    </div>

                    {request.status === "pending" && (
                      <div className="flex gap-3">
                        <Button 
                          onClick={() => handleProcessDeletionRequest(request.id)}
                          disabled={updatingId === request.id}
                          className="flex-1 h-10 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-rose-900/20"
                        >
                          {updatingId === request.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Purge Subject Data"}
                        </Button>
                        <Button variant="outline" className="h-10 border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest">
                          Audit
                        </Button>
                      </div>
                    )}
                    {request.status === "processed" && (
                      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                        <Clock className="h-3 w-3" />
                        Purged on {new Date(request.processedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminConsole;
