import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hasSupabase } from "@/lib/env";
import type { JusticeCase, Organization, SafetyPlan, SurvivorProfile, UserProfile } from "@/data/aegisData";

type FetchOptions = {
  limit?: number;
  offset?: number;
};

type RealtimeOptions = FetchOptions & {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number;
  queryKey?: Array<string | number | boolean | null | undefined>;
};

export type LiveJusticeCase = JusticeCase & {
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string;
  assignedPoliceDepartmentId?: string | null;
  assignedNgoProgramId?: string | null;
};

export type LiveSurvivorProfile = SurvivorProfile & {
  location?: string | null;
};

export type LiveResource = {
  id: string;
  regionId?: string | null;
  resourceType: string;
  name: string;
  description?: string;
  contactInfo?: string;
  available247: boolean;
  languages: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type LivePoliceDepartment = {
  id: string;
  organizationId: string;
  regionId: string;
  departmentName: string;
  jurisdictionLevel: string;
  jurisdictionName: string;
  officersCount: number;
  isActive: boolean;
};

export type LiveNgoProgram = {
  id: string;
  organizationId: string;
  programName: string;
  programType: string;
  focusAreas: string[];
  regionIds: string[];
  isActive: boolean;
};

export type LiveSurvivorChatSession = {
  id: string;
  survivorId?: string | null;
  counselorId?: string | null;
  moodBaseline?: string;
  riskLevelStart?: string;
  riskLevelEnd?: string;
  conversationSummary?: string;
  escalatedToCounselor: boolean;
  consentGranted: boolean;
  createdAt?: string;
  updatedAt?: string;
  endedAt?: string;
};

export type LiveCaseReport = {
  id: string;
  survivorId?: string | null;
  source: string;
  status: string;
  riskLevel: string;
  riskScore: number;
  priority: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

const toString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};
const toNullableString = (value: unknown) => {
  const normalized = toString(value, "").trim();
  return normalized.length > 0 ? normalized : null;
};

const applyPagination = <T extends { limit: (count: number) => T; range: (from: number, to: number) => T }>(query: T, options?: FetchOptions) => {
  if (!options) {
    return query;
  }
  const { limit, offset } = options;
  if (typeof limit === "number" && typeof offset === "number") {
    return query.range(offset, offset + limit - 1);
  }
  if (typeof limit === "number") {
    return query.limit(limit);
  }
  return query;
};

const isMissingTableError = (error: unknown) => {
  const err = error as { status?: number; code?: string; message?: string } | null;
  const message = err?.message?.toLowerCase() ?? "";
  return err?.status === 404 || err?.code === "42P01" || message.includes("does not exist");
};

const useLiveRealtimeQuery = <T,>(key: string, tables: string | string[], queryFn: () => Promise<T>, options?: RealtimeOptions) => {
  const queryClient = useQueryClient();
  const tableSignature = Array.isArray(tables) ? tables.join(",") : tables;
  const enabled = options?.enabled ?? true;
  const queryKey = ["live-dashboard", key, ...(options?.queryKey ?? [])];

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: hasSupabase && enabled,
    staleTime: options?.staleTime,
    refetchInterval: options?.refetchInterval,
  });

  useEffect(() => {
    if (!hasSupabase || !enabled) {
      return;
    }

    const channels = tableSignature
      .split(",")
      .map((tableName) => tableName.trim())
      .filter(Boolean)
      .map((tableName) =>
      supabase
        .channel(`live-dashboard:${key}:${tableName}`)
        .on("postgres_changes", { event: "*", schema: "public", table: tableName }, () => {
          queryClient.invalidateQueries({ queryKey: ["live-dashboard", key] });
        })
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [enabled, key, queryClient, tableSignature]);

  return query;
};

const mapUserProfile = (row: Record<string, unknown>): UserProfile => ({
  id: toString(row.id),
  role: toString(row.role),
  fullName: toString(row.full_name ?? row.fullName),
  avatarUrl: toString(row.avatar_url ?? row.avatarUrl),
  isActive: Boolean(row.is_active ?? row.isActive),
  organizationId: toNullableString(row.organization_id ?? row.organizationId),
  approvalStatus: toNullableString(row.approval_status ?? row.approvalStatus),
  mfaEnabled: Boolean(row.mfa_enabled ?? row.mfaEnabled),
});

const mapOrganization = (row: Record<string, unknown>): Organization => ({
  id: toString(row.id),
  name: toString(row.name),
  type: toString(row.type),
  country: toString(row.country),
  region: toString(row.region),
  organizationSubtype: toString(row.organization_subtype ?? row.organizationSubtype ?? row.type),
  subscriptionLevel: toString(row.subscription_level ?? row.subscriptionLevel, "standard"),
  isVerified: Boolean(row.is_verified ?? row.isVerified),
  supportsVerification: true,
});

const mapJusticeCase = (row: Record<string, unknown>): LiveJusticeCase => ({
  id: toString(row.id),
  caseNumber: toString(row.case_number ?? row.caseNumber),
  type: toString(row.case_type ?? row.type ?? row.caseType),
  region: toString(row.region_name ?? row.region ?? row.regionName ?? row.region_id ?? row.regionId),
  status: toString(row.status),
  daysOpen: toNumber(row.days_open ?? row.daysOpen),
  stage: toString(row.stage),
  assignedTo: toString(row.assigned_to ?? row.assignedTo),
  priority: (toString(row.priority, "medium") as JusticeCase["priority"]),
  createdAt: toNullableString(row.created_at ?? row.createdAt) ?? undefined,
  updatedAt: toNullableString(row.updated_at ?? row.updatedAt) ?? undefined,
  closedAt: toNullableString(row.closed_at ?? row.closedAt) ?? undefined,
  assignedPoliceDepartmentId: toNullableString(row.assigned_police_department_id ?? row.assignedPoliceDepartmentId),
  assignedNgoProgramId: toNullableString(row.assigned_ngo_program_id ?? row.assignedNgoProgramId),
});

const mapSurvivorProfile = (row: Record<string, unknown>): LiveSurvivorProfile => ({
  id: toString(row.id),
  userId: toString(row.user_id ?? row.userId),
  anonymousId: toNullableString(row.anonymous_id ?? row.anonymousId) ?? undefined,
  dateOfBirth: toNullableString(row.date_of_birth ?? row.dateOfBirth) ?? undefined,
  regionId: toNullableString(row.region_id ?? row.regionId) ?? undefined,
  incidentTypes: Array.isArray(row.incident_types ?? row.incidentTypes) ? (row.incident_types ?? row.incidentTypes) as string[] : undefined,
  currentRiskLevel: toString(row.current_risk_level ?? row.currentRiskLevel, "low"),
  safetyPlanExists: Boolean(row.safety_plan_exists ?? row.safetyPlanExists),
  supportStatus: toString(row.support_status ?? row.supportStatus, "active"),
  lastContact: toNullableString(row.last_contact ?? row.lastContact) ?? undefined,
  fullName: toNullableString(row.full_name ?? row.fullName) ?? undefined,
  phoneNumber: toNullableString(row.phone_number ?? row.phoneNumber) ?? undefined,
  emergencyContact: toNullableString(row.emergency_contact ?? row.emergencyContact) ?? undefined,
  location: toNullableString(row.region_name ?? row.location ?? row.regionLabel),
});

const mapSafetyPlan = (row: Record<string, unknown>): SafetyPlan => ({
  id: toString(row.id),
  survivorId: toString(row.survivor_id ?? row.survivorId),
  trustedContacts: Array.isArray(row.trusted_contacts ?? row.trustedContacts) ? (row.trusted_contacts ?? row.trustedContacts) as string[] : [],
  safeLocations: Array.isArray(row.safe_locations ?? row.safeLocations) ? (row.safe_locations ?? row.safeLocations) as string[] : [],
  emergencyResources: Array.isArray(row.emergency_resources ?? row.emergencyResources) ? (row.emergency_resources ?? row.emergencyResources) as string[] : [],
  identifiedTriggers: Array.isArray(row.identified_triggers ?? row.identifiedTriggers) ? (row.identified_triggers ?? row.identifiedTriggers) as string[] : [],
  copingStrategies: Array.isArray(row.coping_strategies ?? row.copingStrategies) ? (row.coping_strategies ?? row.copingStrategies) as string[] : [],
  createdAt: toString(row.created_at ?? row.createdAt),
  updatedAt: toString(row.updated_at ?? row.updatedAt),
});

const mapResource = (row: Record<string, unknown>): LiveResource => ({
  id: toString(row.id),
  regionId: toNullableString(row.region_id ?? row.regionId),
  resourceType: toString(row.resource_type ?? row.resourceType),
  name: toString(row.name),
  description: toNullableString(row.description) ?? undefined,
  contactInfo: toNullableString(row.contact_info ?? row.contactInfo) ?? undefined,
  available247: Boolean(row.available_24_7 ?? row.available247),
  languages: Array.isArray(row.languages_spoken ?? row.languagesSpoken) ? (row.languages_spoken ?? row.languagesSpoken) as string[] : [],
  createdAt: toNullableString(row.created_at ?? row.createdAt) ?? undefined,
  updatedAt: toNullableString(row.updated_at ?? row.updatedAt) ?? undefined,
});

const mapPoliceDepartment = (row: Record<string, unknown>): LivePoliceDepartment => ({
  id: toString(row.id),
  organizationId: toString(row.organization_id ?? row.organizationId),
  regionId: toString(row.region_id ?? row.regionId),
  departmentName: toString(row.department_name ?? row.departmentName),
  jurisdictionLevel: toString(row.jurisdiction_level ?? row.jurisdictionLevel),
  jurisdictionName: toString(row.jurisdiction_name ?? row.jurisdictionName),
  officersCount: toNumber(row.officers_count ?? row.officersCount),
  isActive: Boolean(row.is_active ?? row.isActive),
});

const mapNgoProgram = (row: Record<string, unknown>): LiveNgoProgram => ({
  id: toString(row.id),
  organizationId: toString(row.organization_id ?? row.organizationId),
  programName: toString(row.program_name ?? row.programName),
  programType: toString(row.program_type ?? row.programType),
  focusAreas: Array.isArray(row.focus_areas ?? row.focusAreas) ? (row.focus_areas ?? row.focusAreas) as string[] : [],
  regionIds: Array.isArray(row.region_ids ?? row.regionIds) ? (row.region_ids ?? row.regionIds) as string[] : [],
  isActive: Boolean(row.is_active ?? row.isActive),
});

const mapSurvivorChatSession = (row: Record<string, unknown>): LiveSurvivorChatSession => ({
  id: toString(row.id),
  survivorId: toNullableString(row.survivor_id ?? row.survivorId),
  counselorId: toNullableString(row.counselor_id ?? row.counselorId),
  moodBaseline: toNullableString(row.mood_baseline ?? row.moodBaseline) ?? undefined,
  riskLevelStart: toNullableString(row.risk_level_start ?? row.riskLevelStart) ?? undefined,
  riskLevelEnd: toNullableString(row.risk_level_end ?? row.riskLevelEnd) ?? undefined,
  conversationSummary: toNullableString(row.conversation_summary ?? row.conversationSummary) ?? undefined,
  escalatedToCounselor: Boolean(row.escalated_to_counselor ?? row.escalatedToCounselor),
  consentGranted: Boolean(row.consent_granted ?? row.consentGranted),
  createdAt: toNullableString(row.created_at ?? row.createdAt) ?? undefined,
  updatedAt: toNullableString(row.updated_at ?? row.updatedAt) ?? undefined,
  endedAt: toNullableString(row.ended_at ?? row.endedAt) ?? undefined,
});

const mapCaseReport = (row: Record<string, unknown>): LiveCaseReport => ({
  id: toString(row.id),
  survivorId: toNullableString(row.survivor_id ?? row.survivorId),
  source: toString(row.source),
  status: toString(row.status),
  riskLevel: toString(row.risk_level ?? row.riskLevel),
  riskScore: toNumber(row.risk_score ?? row.riskScore),
  priority: toString(row.priority, "medium"),
  description: toNullableString(row.description) ?? undefined,
  createdAt: toNullableString(row.created_at ?? row.createdAt) ?? undefined,
  updatedAt: toNullableString(row.updated_at ?? row.updatedAt) ?? undefined,
});

const fetchLiveUserProfiles = async (options?: FetchOptions & { role?: string; organizationId?: string | null }) => {
  if (!hasSupabase) return [] as UserProfile[];
  let query = supabase
    .from("user_profiles")
    .select("id,role,full_name,avatar_url,is_active,organization_id,approval_status,mfa_enabled,created_at")
    .order("created_at", { ascending: false });

  if (options?.role) query = query.eq("role", options.role);
  if (options?.organizationId) query = query.eq("organization_id", options.organizationId);

  const { data, error } = await applyPagination(query, options);
  if (error) {
    if (isMissingTableError(error)) return [] as UserProfile[];
    throw error;
  }
  return (data ?? []).map((row) => mapUserProfile(row as Record<string, unknown>));
};

const fetchLiveOrganization = async (organizationId: string) => {
  if (!hasSupabase) return null as Organization | null;
  const { data, error } = await supabase
    .from("organizations")
    .select("id,name,type,country,region,organization_subtype,subscription_level,is_verified")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  return data ? mapOrganization(data as Record<string, unknown>) : null;
};

const fetchLiveJusticeCases = async (options?: FetchOptions & { assignedTo?: string | null; regionId?: string | null; statuses?: string[] }) => {
  if (!hasSupabase) return [] as LiveJusticeCase[];
  let query = supabase
    .from("justice_cases")
    .select("id,case_number,case_type,status,days_open,stage,assigned_to,priority,created_at,updated_at,closed_at,assigned_police_department_id,assigned_ngo_program_id,region_id,regions(name)")
    .order("updated_at", { ascending: false });

  if (options?.assignedTo) query = query.eq("assigned_to", options.assignedTo);
  if (options?.regionId) query = query.eq("region_id", options.regionId);
  if (options?.statuses && options.statuses.length > 0) query = query.in("status", options.statuses);

  const { data, error } = await applyPagination(query, options);
  if (error) {
    if (isMissingTableError(error)) return [] as LiveJusticeCase[];
    throw error;
  }

  return (data ?? []).map((row) => {
    const mapped = row as Record<string, unknown> & { regions?: { name?: unknown } | Array<{ name?: unknown }> };
    const related = Array.isArray(mapped.regions) ? mapped.regions[0] : mapped.regions;
    return mapJusticeCase({ ...mapped, region_name: related?.name ?? mapped.region_name });
  });
};

const fetchLiveSurvivors = async (options?: FetchOptions & { userId?: string | null }) => {
  if (!hasSupabase) return [] as LiveSurvivorProfile[];
  let query = supabase
    .from("survivors")
    .select("id,user_id,anonymous_id,date_of_birth,region_id,incident_types,current_risk_level,safety_plan_exists,support_status,last_contact,full_name,phone_number,emergency_contact,regions(name),created_at")
    .order("last_contact", { ascending: false });

  if (options?.userId) query = query.eq("user_id", options.userId);

  const { data, error } = await applyPagination(query, options);
  if (error) {
    if (isMissingTableError(error)) return [] as LiveSurvivorProfile[];
    throw error;
  }

  return (data ?? []).map((row) => {
    const mapped = row as Record<string, unknown> & { regions?: { name?: unknown } | Array<{ name?: unknown }> };
    const related = Array.isArray(mapped.regions) ? mapped.regions[0] : mapped.regions;
    return mapSurvivorProfile({ ...mapped, region_name: related?.name ?? mapped.region_name });
  });
};

const fetchLiveSafetyPlans = async (options?: FetchOptions & { survivorId?: string | null }) => {
  if (!hasSupabase) return [] as SafetyPlan[];
  let query = supabase
    .from("safety_plans")
    .select("id,survivor_id,trusted_contacts,safe_locations,emergency_resources,identified_triggers,coping_strategies,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (options?.survivorId) query = query.eq("survivor_id", options.survivorId);

  const { data, error } = await applyPagination(query, options);
  if (error) {
    if (isMissingTableError(error)) return [] as SafetyPlan[];
    throw error;
  }
  return (data ?? []).map((row) => mapSafetyPlan(row as Record<string, unknown>));
};

const fetchLiveResources = async (options?: FetchOptions & { resourceType?: string | null; regionId?: string | null }) => {
  if (!hasSupabase) return [] as LiveResource[];
  let query = supabase
    .from("resources")
    .select("id,region_id,resource_type,name,description,contact_info,available_24_7,languages_spoken,created_at,updated_at")
    .order("name", { ascending: true });

  if (options?.resourceType) query = query.eq("resource_type", options.resourceType);
  if (options?.regionId) query = query.eq("region_id", options.regionId);

  const { data, error } = await applyPagination(query, options);
  if (error) {
    if (isMissingTableError(error)) return [] as LiveResource[];
    throw error;
  }
  return (data ?? []).map((row) => mapResource(row as Record<string, unknown>));
};

const fetchLivePoliceDepartments = async (options?: FetchOptions & { organizationId?: string | null }) => {
  if (!hasSupabase) return [] as LivePoliceDepartment[];
  let query = supabase
    .from("police_departments")
    .select("id,organization_id,region_id,department_name,jurisdiction_level,jurisdiction_name,officers_count,is_active,created_at")
    .order("department_name", { ascending: true });

  if (options?.organizationId) query = query.eq("organization_id", options.organizationId);

  const { data, error } = await applyPagination(query, options);
  if (error) {
    if (isMissingTableError(error)) return [] as LivePoliceDepartment[];
    throw error;
  }
  return (data ?? []).map((row) => mapPoliceDepartment(row as Record<string, unknown>));
};

const fetchLiveNgoPrograms = async (options?: FetchOptions & { organizationId?: string | null }) => {
  if (!hasSupabase) return [] as LiveNgoProgram[];
  let query = supabase
    .from("ngo_programs")
    .select("id,organization_id,program_name,program_type,focus_areas,region_ids,is_active,created_at")
    .order("program_name", { ascending: true });

  if (options?.organizationId) query = query.eq("organization_id", options.organizationId);

  const { data, error } = await applyPagination(query, options);
  if (error) {
    if (isMissingTableError(error)) return [] as LiveNgoProgram[];
    throw error;
  }
  return (data ?? []).map((row) => mapNgoProgram(row as Record<string, unknown>));
};

const fetchLiveSurvivorChatSessions = async (options?: FetchOptions & { survivorId?: string | null; counselorId?: string | null }) => {
  if (!hasSupabase) return [] as LiveSurvivorChatSession[];
  let query = supabase
    .from("survivor_chat_sessions")
    .select("id,survivor_id,counselor_id,mood_baseline,risk_level_start,risk_level_end,conversation_summary,escalated_to_counselor,consent_granted,created_at,updated_at,ended_at")
    .order("updated_at", { ascending: false });

  if (options?.survivorId) query = query.eq("survivor_id", options.survivorId);
  if (options?.counselorId) query = query.eq("counselor_id", options.counselorId);

  const { data, error } = await applyPagination(query, options);
  if (error) {
    if (isMissingTableError(error)) return [] as LiveSurvivorChatSession[];
    throw error;
  }
  return (data ?? []).map((row) => mapSurvivorChatSession(row as Record<string, unknown>));
};

const fetchLiveCaseReports = async (options?: FetchOptions & { survivorId?: string | null; caseId?: string | null }) => {
  if (!hasSupabase) return [] as LiveCaseReport[];
  let query = supabase
    .from("case_reports")
    .select("id,survivor_id,source,status,risk_level,risk_score,priority,description,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (options?.survivorId) query = query.eq("survivor_id", options.survivorId);
  if (options?.caseId) query = query.eq("id", options.caseId);

  const { data, error } = await applyPagination(query, options);
  if (error) {
    if (isMissingTableError(error)) return [] as LiveCaseReport[];
    throw error;
  }
  return (data ?? []).map((row) => mapCaseReport(row as Record<string, unknown>));
};

export const useLiveUserProfiles = (options?: RealtimeOptions & { role?: string; organizationId?: string | null }) =>
  useLiveRealtimeQuery("userProfiles", "user_profiles", () => fetchLiveUserProfiles(options), {
    ...options,
    queryKey: [options?.role ?? "all", options?.organizationId ?? "all", options?.limit ?? "all", options?.offset ?? 0],
  });

export const useLiveOrganization = (organizationId?: string | null, options?: RealtimeOptions) =>
  useLiveRealtimeQuery("organization", "organizations", () => (organizationId ? fetchLiveOrganization(organizationId) : Promise.resolve(null)), {
    ...options,
    enabled: Boolean(organizationId) && (options?.enabled ?? true),
    queryKey: [organizationId ?? "none"],
  });

export const useLiveJusticeCases = (options?: RealtimeOptions & { assignedTo?: string | null; regionId?: string | null; statuses?: string[] }) =>
  useLiveRealtimeQuery("justiceCases", ["justice_cases", "regions"], () => fetchLiveJusticeCases(options), {
    ...options,
    queryKey: [options?.assignedTo ?? "all", options?.regionId ?? "all", (options?.statuses ?? []).join("|"), options?.limit ?? "all", options?.offset ?? 0],
  });

export const useLiveSurvivors = (options?: RealtimeOptions & { userId?: string | null }) =>
  useLiveRealtimeQuery("survivors", ["survivors", "regions"], () => fetchLiveSurvivors(options), {
    ...options,
    queryKey: [options?.userId ?? "all", options?.limit ?? "all", options?.offset ?? 0],
  });

export const useLiveSafetyPlans = (options?: RealtimeOptions & { survivorId?: string | null }) =>
  useLiveRealtimeQuery("safetyPlans", "safety_plans", () => fetchLiveSafetyPlans(options), {
    ...options,
    queryKey: [options?.survivorId ?? "all", options?.limit ?? "all", options?.offset ?? 0],
  });

export const useLiveResources = (options?: RealtimeOptions & { resourceType?: string | null; regionId?: string | null }) =>
  useLiveRealtimeQuery("resources", "resources", () => fetchLiveResources(options), {
    ...options,
    queryKey: [options?.resourceType ?? "all", options?.regionId ?? "all", options?.limit ?? "all", options?.offset ?? 0],
  });

export const useLivePoliceDepartments = (options?: RealtimeOptions & { organizationId?: string | null }) =>
  useLiveRealtimeQuery("policeDepartments", "police_departments", () => fetchLivePoliceDepartments(options), {
    ...options,
    queryKey: [options?.organizationId ?? "all", options?.limit ?? "all", options?.offset ?? 0],
  });

export const useLiveNgoPrograms = (options?: RealtimeOptions & { organizationId?: string | null }) =>
  useLiveRealtimeQuery("ngoPrograms", "ngo_programs", () => fetchLiveNgoPrograms(options), {
    ...options,
    queryKey: [options?.organizationId ?? "all", options?.limit ?? "all", options?.offset ?? 0],
  });

export const useLiveSurvivorChatSessions = (options?: RealtimeOptions & { survivorId?: string | null; counselorId?: string | null }) =>
  useLiveRealtimeQuery("survivorChatSessions", "survivor_chat_sessions", () => fetchLiveSurvivorChatSessions(options), {
    ...options,
    queryKey: [options?.survivorId ?? "all", options?.counselorId ?? "all", options?.limit ?? "all", options?.offset ?? 0],
  });

export const useLiveCaseReports = (options?: RealtimeOptions & { survivorId?: string | null; caseId?: string | null }) =>
  useLiveRealtimeQuery("caseReports", "case_reports", () => fetchLiveCaseReports(options), {
    ...options,
    queryKey: [options?.survivorId ?? "all", options?.caseId ?? "all", options?.limit ?? "all", options?.offset ?? 0],
  });
