import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { hasSupabase } from "@/lib/env"
import { getErrorMessage } from "@/lib/logger"

export { getErrorMessage }

export type RiskLevel = "low" | "medium" | "high" | "critical"
export type ModuleType = "dashboard" | "personal_dashboard" | "reporting" | "admin_console" | "command_center" | "survivor_support" | "prediction" | "justice" | "policy" | "governance"
export type TrendDirection = "up" | "down" | "stable"

export type ModuleMetadata = {
  title: string
  subtitle: string
  label: string
  shortLabel: string
  description: string
  colorClass: string
}

export interface RegionData {
  id: string
  name: string
  country: string
  riskLevel: RiskLevel
  riskScore: number
  incidents: number
  trend: TrendDirection
  trendPercent: number
  lat: number
  lng: number
  population: number
  shelters: number
  agents: number
}

export interface TimeSeriesPoint {
  date: string
  value: number
  predicted?: number
  lower?: number
  upper?: number
}

export interface PolicyScenario {
  id: string
  name: string
  description: string
  category: string
  impact: number
  cost: string
  timeframe: string
  confidence: number
  gbvReduction: number
  iterations: number
}

export interface JusticeCase {
  id: string
  caseNumber: string
  type: string
  region: string
  status: string
  daysOpen: number
  stage: string
  assignedTo: string
  priority: RiskLevel
}

export interface SystemMetrics {
  totalIncidents: number
  activeAlerts: number
  survivorsSupported: number
  modelsDeployed: number
  regionsMonitored: number
  countriesActive: number
  avgResponseTime: string
  systemUptime: number
  casesProcessed: number
  convictionRate: number
  avgCaseDuration: number
  shelterOccupancy: number
  agentsOnline: number
  apiRequestsToday: number
  dataPointsProcessed: string
  encryptionStatus: string
}

export interface AlertItem {
  id: string
  time: string
  type: string
  message: string
  module: string
  status?: string
}

export interface ContinentalStat {
  incidents: number
  riskScore: number
  trend: number
  shelters: number
  agents: number
}

export type ContinentalStats = Record<string, ContinentalStat>

export interface FairnessMetric {
  metric: string
  score: number
  threshold: number
  status: "pass" | "warning" | "fail"
}

export interface GovernanceModel {
  name: string
  version: string
  module: string
  status: string
  accuracy: number
  fairness: number
  drift: number
}

export interface AuditLog {
  time: string
  action: string
  module: string
  user: string
  severity: string
  description?: string
}

export interface BiasReport {
  model: string
  finding: string
  severity: "pass" | "warning" | "fail"
  recommendation: string
}

export interface EthicalConstraint {
  constraint: string
  active: boolean
}

export interface EscalationReview {
  id: string
  sessionId: string
  riskLevel: string
  emotionDetected: string
  status: string
  assignedTo: string
  resolutionSummary: string
  createdAt: string
  updatedAt: string
  resolvedAt: string
}

export interface DeletionRequest {
  id: string
  userId: string
  survivorId: string
  status: string
  requestedAt: string
  processedAt: string
  processedBy: string
  reason: string
}

export interface SurvivorProfile {
  id: string
  userId: string
  anonymousId?: string
  dateOfBirth?: string
  regionId?: string
  incidentTypes?: string[]
  currentRiskLevel: string
  safetyPlanExists: boolean
  supportStatus: string
  lastContact?: string
  fullName?: string
  phoneNumber?: string
  emergencyContact?: string
}

export interface SafetyPlan {
  id: string
  survivorId: string
  trustedContacts: string[]
  safeLocations: string[]
  emergencyResources: string[]
  identifiedTriggers: string[]
  copingStrategies: string[]
  createdAt: string
  updatedAt: string
}

export interface UserProfile {
  id: string
  role: string
  fullName: string
  avatarUrl: string
  isActive: boolean
  organizationId?: string | null
  approvalStatus?: string | null
  mfaEnabled?: boolean
}

export interface JusticeConviction {
  region: string
  rate: number
  cases: number
}

export interface Organization {
  id: string
  name: string
  type: string
  country: string
  region: string
  organizationSubtype: string
  subscriptionLevel: string
  isVerified: boolean
  supportsVerification: boolean
}

export interface JusticeBottleneck {
  stage: string
  avgDelay: number
  severity: "low" | "medium" | "high"
  description: string
}

export interface OrganizationCoordination {
  id: string
  fromOrganizationId: string
  toOrganizationId: string
  caseId: string
  referralType: string
  status: string
  notes: string
  createdAt: string
  updatedAt: string
  completedAt: string
}

export interface RegionIncidentType {
  type: string
  pct: number
}

export interface RegionForecast {
  forecastDays: number
  label: string
  riskChange: number
}

export interface AnomalyAlert {
  id: string
  region: string
  type: string
  severity: "low" | "medium" | "high" | "critical"
  time: string
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#10B981",
  medium: "#F59E0B",
  high: "#F97316",
  critical: "#EF4444",
}

export const MODULE_COLORS: Record<string, string> = {
  dashboard: "#38BDF8",
  personal_dashboard: "#A855F7",
  reporting: "#F97316",
  admin_console: "#EF4444",
  command_center: "#6366F1",
  survivor_support: "#EC4899",
  prediction: "#F59E0B",
  justice: "#3B82F6",
  policy: "#8B5CF6",
  governance: "#10B981",
}

export const MODULE_METADATA: Record<ModuleType, ModuleMetadata> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Role-specific overview",
    label: "Dashboard",
    shortLabel: "DB",
    description: "Role-specific overview and daily priorities",
    colorClass: "text-cyan-400",
  },
  personal_dashboard: {
    title: "Personal Dashboard",
    subtitle: "Safety plans and personal support",
    label: "Personal Dashboard",
    shortLabel: "PD",
    description: "Safety plan, appointments, and personal documents",
    colorClass: "text-purple-400",
  },
  reporting: {
    title: "Reporting Center",
    subtitle: "Impact summaries and exports",
    label: "Reporting",
    shortLabel: "REP",
    description: "Organization reports, exports, and impact summaries",
    colorClass: "text-orange-400",
  },
  admin_console: {
    title: "Admin Console",
    subtitle: "Users, organizations, and configuration",
    label: "Admin Console",
    shortLabel: "ADM",
    description: "Users, organizations, and configuration settings",
    colorClass: "text-red-400",
  },
  command_center: {
    title: "Command Center",
    subtitle: "Continental Operations Overview",
    label: "Command Center",
    shortLabel: "CMD",
    description: "Continental Operations Overview - Real-time incident monitoring",
    colorClass: "text-indigo-400",
  },
  survivor_support: {
    title: "Survivor Support Engine",
    subtitle: "Trauma-Informed AI Assistant",
    label: "Survivor Support",
    shortLabel: "SSE",
    description: "Trauma-Informed AI Assistant - Confidential support",
    colorClass: "text-pink-400",
  },
  prediction: {
    title: "Risk Prediction Engine",
    subtitle: "Spatio-Temporal Intelligence",
    label: "Risk Prediction",
    shortLabel: "RPE",
    description: "Spatio-Temporal Intelligence - Predictive analytics",
    colorClass: "text-amber-400",
  },
  justice: {
    title: "Justice Analytics",
    subtitle: "Institutional Optimization",
    label: "Justice Analytics",
    shortLabel: "JOE",
    description: "Institutional Optimization - Case tracking",
    colorClass: "text-blue-400",
  },
  policy: {
    title: "Policy Simulation Lab",
    subtitle: "Multi-Agent Foresight Engine",
    label: "Policy Simulation",
    shortLabel: "PSE",
    description: "Multi-Agent Foresight Engine - Policy simulation",
    colorClass: "text-purple-400",
  },
  governance: {
    title: "Ethical AI Governance",
    subtitle: "Fairness & Compliance Core",
    label: "AI Governance",
    shortLabel: "EGC",
    description: "Fairness & Compliance Core - Ethical governance",
    colorClass: "text-emerald-400",
  },
}

export const MODULE_LIST = Object.keys(MODULE_METADATA) as ModuleType[]

type FetchOptions = {
  limit?: number
  offset?: number
}

const applyPagination = <T extends { limit: (count: number) => T; range: (from: number, to: number) => T }>(query: T, options?: FetchOptions) => {
  if (!options) {
    return query
  }
  const { limit, offset } = options
  if (typeof limit === "number" && typeof offset === "number") {
    return query.range(offset, offset + limit - 1)
  }
  if (typeof limit === "number") {
    return query.limit(limit)
  }
  return query
}

const isMissingTableError = (error: unknown) => {
  if (!error) return false
  const err = error as { status?: number; code?: string; message?: string }
  const status = err.status
  const code = err.code
  const message = err.message?.toLowerCase() ?? ""
  return (
    status === 404 || 
    code === "42P01" || 
    code === "PGRST204" || // Missing column/table
    message.includes("relation") && message.includes("does not exist") ||
    message.includes("could not find") && (message.includes("in the api") || message.includes("schema cache") || message.includes("table")) ||
    message.includes("failed to fetch") || // Network errors
    message.includes("unknown error") // Generic error handling
  )
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toString = (value: unknown, fallback = "") => {
  if (typeof value === "string") return value
  if (value === null || value === undefined) return fallback
  return String(value)
}

const toRiskLevel = (value: unknown): RiskLevel => {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value
  }
  return "low"
}

const toTrendDirection = (value: unknown): TrendDirection => {
  if (value === "up" || value === "down" || value === "stable") {
    return value
  }
  return "stable"
}

const mapRegion = (row: Record<string, unknown>): RegionData => ({
  id: toString(row.id),
  name: toString(row.name),
  country: toString(row.country),
  riskLevel: toRiskLevel(row.risk_level ?? row.riskLevel),
  riskScore: toNumber(row.risk_score ?? row.riskScore),
  incidents: toNumber(row.incidents),
  trend: toTrendDirection(row.trend),
  trendPercent: toNumber(row.trend_percent ?? row.trendPercent),
  lat: toNumber(row.lat),
  lng: toNumber(row.lng),
  population: toNumber(row.population),
  shelters: toNumber(row.shelters),
  agents: toNumber(row.agents),
})

const mapSystemMetrics = (row: Record<string, unknown>): SystemMetrics => ({
  totalIncidents: toNumber(row.total_incidents ?? row.totalIncidents),
  activeAlerts: toNumber(row.active_alerts ?? row.activeAlerts),
  survivorsSupported: toNumber(row.survivors_supported ?? row.survivorsSupported),
  modelsDeployed: toNumber(row.models_deployed ?? row.modelsDeployed),
  regionsMonitored: toNumber(row.regions_monitored ?? row.regionsMonitored),
  countriesActive: toNumber(row.countries_active ?? row.countriesActive),
  avgResponseTime: toString(row.avg_response_time ?? row.avg_response_time_seconds ?? row.avgResponseTime, ""),
  systemUptime: toNumber(row.system_uptime ?? row.system_uptime_percent ?? row.systemUptime),
  casesProcessed: toNumber(row.cases_processed ?? row.casesProcessed),
  convictionRate: toNumber(row.conviction_rate ?? row.convictionRate),
  avgCaseDuration: toNumber(row.avg_case_duration ?? row.avg_case_duration_days ?? row.avgCaseDuration),
  shelterOccupancy: toNumber(row.shelter_occupancy ?? row.shelter_occupancy_percent ?? row.shelterOccupancy),
  agentsOnline: toNumber(row.agents_online ?? row.agentsOnline),
  apiRequestsToday: toNumber(row.api_requests_today ?? row.apiRequestsToday),
  dataPointsProcessed: toString(row.data_points_processed ?? row.dataPointsProcessed, ""),
  encryptionStatus: toString(row.encryption_status ?? row.encryptionStatus, ""),
})

const mapPolicyScenario = (row: Record<string, unknown>): PolicyScenario => ({
  id: toString(row.id),
  name: toString(row.name),
  description: toString(row.description),
  category: toString(row.category),
  impact: toNumber(row.impact),
  cost: toString(row.cost),
  timeframe: toString(row.timeframe),
  confidence: toNumber(row.confidence),
  gbvReduction: toNumber(row.gbv_reduction ?? row.gbvReduction),
  iterations: toNumber(row.iterations),
})

const mapJusticeCase = (row: Record<string, unknown>): JusticeCase => ({
  id: toString(row.id),
  caseNumber: toString(row.case_number ?? row.caseNumber),
  type: toString(row.type),
  region: toString(row.region),
  status: toString(row.status),
  daysOpen: toNumber(row.days_open ?? row.daysOpen),
  stage: toString(row.stage),
  assignedTo: toString(row.assigned_to ?? row.assignedTo),
  priority: toRiskLevel(row.priority),
})

const mapAlert = (row: Record<string, unknown>): AlertItem => ({
  id: toString(row.id),
  time: toString(row.time),
  type: toString(row.type),
  message: toString(row.message),
  module: toString(row.module),
  status: toString(row.status ?? "pending"),
})

const mapContinentalStat = (row: Record<string, unknown>): ContinentalStat => ({
  incidents: toNumber(row.incidents),
  riskScore: toNumber(row.risk_score ?? row.riskScore),
  trend: toNumber(row.trend),
  shelters: toNumber(row.shelters),
  agents: toNumber(row.agents),
})

const mapTimeSeries = (row: Record<string, unknown>): TimeSeriesPoint => ({
  date: toString(row.date),
  value: toNumber(row.value),
  predicted: row.predicted === null || row.predicted === undefined ? undefined : toNumber(row.predicted),
  lower: row.lower === null || row.lower === undefined ? undefined : toNumber(row.lower),
  upper: row.upper === null || row.upper === undefined ? undefined : toNumber(row.upper),
})

const mapFairnessMetric = (row: Record<string, unknown>): FairnessMetric => ({
  metric: toString(row.metric),
  score: toNumber(row.score),
  threshold: toNumber(row.threshold),
  status: (row.status === "pass" || row.status === "warning" || row.status === "fail") ? row.status : "warning",
})

const mapGovernanceModel = (row: Record<string, unknown>): GovernanceModel => ({
  name: toString(row.name),
  version: toString(row.version),
  module: toString(row.module),
  status: toString(row.status),
  accuracy: toNumber(row.accuracy),
  fairness: toNumber(row.fairness),
  drift: toNumber(row.drift),
})

const mapAuditLog = (row: Record<string, unknown>): AuditLog => ({
  time: toString(row.created_at ?? row.time),
  action: toString(row.action),
  module: toString(row.module),
  user: toString(row.user_id ?? row.user),
  severity: toString(row.severity),
  description: toString(row.description, "") || undefined,
})

const mapBiasReport = (row: Record<string, unknown>): BiasReport => ({
  model: toString(row.model),
  finding: toString(row.finding),
  severity: (row.severity === "pass" || row.severity === "warning" || row.severity === "fail") ? row.severity : "warning",
  recommendation: toString(row.recommendation),
})

const mapEthicalConstraint = (row: Record<string, unknown>): EthicalConstraint => ({
  constraint: toString(row.name ?? row.constraint_text ?? row.constraint),
  active: Boolean(row.active),
})

const mapEscalationReview = (row: Record<string, unknown>): EscalationReview => ({
  id: toString(row.id),
  sessionId: toString(row.session_id ?? row.sessionId),
  riskLevel: toString(row.risk_level ?? row.riskLevel),
  emotionDetected: toString(row.emotion_detected ?? row.emotionDetected),
  status: toString(row.status),
  assignedTo: toString(row.assigned_to ?? row.assignedTo),
  resolutionSummary: toString(row.resolution_summary ?? row.resolutionSummary),
  createdAt: toString(row.created_at ?? row.createdAt),
  updatedAt: toString(row.updated_at ?? row.updatedAt),
  resolvedAt: toString(row.resolved_at ?? row.resolvedAt),
})

const mapDeletionRequest = (row: Record<string, unknown>): DeletionRequest => ({
  id: toString(row.id),
  userId: toString(row.user_id ?? row.userId),
  survivorId: toString(row.survivor_id ?? row.survivorId),
  status: toString(row.status),
  requestedAt: toString(row.requested_at ?? row.requestedAt),
  processedAt: toString(row.processed_at ?? row.processedAt),
  processedBy: toString(row.processed_by ?? row.processedBy),
  reason: toString(row.reason),
})

const mapSurvivorProfile = (row: Record<string, unknown>): SurvivorProfile => ({
  id: toString(row.id),
  userId: toString(row.user_id ?? row.userId),
  anonymousId: toString(row.anonymous_id ?? row.anonymousId, "") || undefined,
  dateOfBirth: toString(row.date_of_birth ?? row.dateOfBirth, "") || undefined,
  regionId: toString(row.region_id ?? row.regionId, "") || undefined,
  incidentTypes: Array.isArray(row.incident_types ?? row.incidentTypes) 
    ? (row.incident_types ?? row.incidentTypes) as string[] 
    : undefined,
  currentRiskLevel: toString(row.current_risk_level ?? row.currentRiskLevel, "low"),
  safetyPlanExists: Boolean(row.safety_plan_exists ?? row.safetyPlanExists),
  supportStatus: toString(row.support_status ?? row.supportStatus, "active"),
  lastContact: toString(row.last_contact ?? row.lastContact, "") || undefined,
  fullName: toString(row.full_name ?? row.fullName, "") || undefined,
  phoneNumber: toString(row.phone_number ?? row.phoneNumber, "") || undefined,
  emergencyContact: toString(row.emergency_contact ?? row.emergencyContact, "") || undefined,
})

const mapSafetyPlan = (row: Record<string, unknown>): SafetyPlan => ({
  id: toString(row.id),
  survivorId: toString(row.survivor_id ?? row.survivorId),
  trustedContacts: Array.isArray(row.trusted_contacts ?? row.trustedContacts) 
    ? (row.trusted_contacts ?? row.trustedContacts) as string[] 
    : [],
  safeLocations: Array.isArray(row.safe_locations ?? row.safeLocations) 
    ? (row.safe_locations ?? row.safeLocations) as string[] 
    : [],
  emergencyResources: Array.isArray(row.emergency_resources ?? row.emergencyResources) 
    ? (row.emergency_resources ?? row.emergencyResources) as string[] 
    : [],
  identifiedTriggers: Array.isArray(row.identified_triggers ?? row.identifiedTriggers) 
    ? (row.identified_triggers ?? row.identifiedTriggers) as string[] 
    : [],
  copingStrategies: Array.isArray(row.coping_strategies ?? row.copingStrategies) 
    ? (row.coping_strategies ?? row.copingStrategies) as string[] 
    : [],
  createdAt: toString(row.created_at ?? row.createdAt),
  updatedAt: toString(row.updated_at ?? row.updatedAt),
})

const mapUserProfile = (row: Record<string, unknown>): UserProfile => ({
  id: toString(row.id),
  role: toString(row.role),
  fullName: toString(row.full_name ?? row.fullName),
  avatarUrl: toString(row.avatar_url ?? row.avatarUrl),
  isActive: Boolean(row.is_active ?? row.isActive),
  organizationId: toString(row.organization_id ?? row.organizationId, "") || null,
  approvalStatus: toString(row.approval_status ?? row.approvalStatus, "") || null,
  mfaEnabled: Boolean(row.mfa_enabled ?? row.mfaEnabled),
})

const mapJusticeConviction = (row: Record<string, unknown>): JusticeConviction => ({
  region: toString(row.region),
  rate: toNumber(row.rate),
  cases: toNumber(row.cases),
})

const mapOrganization = (row: Record<string, unknown>): Organization => {
  const supportsVerification = Object.prototype.hasOwnProperty.call(row, "is_verified")
    || Object.prototype.hasOwnProperty.call(row, "isVerified")

  return {
    id: toString(row.id),
    name: toString(row.name),
    type: toString(row.type),
    country: toString(row.country),
    region: toString(row.region),
    organizationSubtype: toString(row.type),
    subscriptionLevel: toString(row.subscription_level ?? row.subscriptionLevel, "Standard"),
    isVerified: Boolean(row.is_verified ?? row.isVerified),
    supportsVerification,
  }
}

const mapOrganizationCoordination = (row: Record<string, unknown>): OrganizationCoordination => ({
  id: toString(row.id),
  fromOrganizationId: toString(row.from_organization_id ?? row.fromOrganizationId),
  toOrganizationId: toString(row.to_organization_id ?? row.toOrganizationId),
  caseId: toString(row.case_id ?? row.caseId),
  referralType: toString(row.referral_type ?? row.referralType),
  status: toString(row.status),
  notes: toString(row.notes),
  createdAt: toString(row.created_at ?? row.createdAt),
  updatedAt: toString(row.updated_at ?? row.updatedAt),
  completedAt: toString(row.completed_at ?? row.completedAt),
})

const mapJusticeBottleneck = (row: Record<string, unknown>): JusticeBottleneck => ({
  stage: toString(row.stage),
  avgDelay: toNumber(row.avg_delay ?? row.avgDelay),
  severity: (row.severity === "low" || row.severity === "medium" || row.severity === "high") ? row.severity : "low",
  description: toString(row.description),
})

const mapRegionIncidentType = (row: Record<string, unknown>): RegionIncidentType => ({
  type: toString(row.type),
  pct: toNumber(row.pct),
})

const mapRegionForecast = (row: Record<string, unknown>): RegionForecast => ({
  forecastDays: toNumber(row.forecast_days ?? row.forecastDays),
  label: toString(row.label),
  riskChange: toNumber(row.risk_change ?? row.riskChange),
})

const mapAnomalyAlert = (row: Record<string, unknown>): AnomalyAlert => ({
  id: toString(row.id),
  region: toString(row.region),
  type: toString(row.type),
  severity: (row.severity === "low" || row.severity === "medium" || row.severity === "high" || row.severity === "critical") ? row.severity : "low",
  time: toString(row.time),
})

type RealtimeQueryOptions = {
  enabled?: boolean
  staleTime?: number
  refetchInterval?: number
  queryKey?: Array<string | number | boolean | null | undefined>
}

type ListQueryOptions = FetchOptions & RealtimeQueryOptions

const useRealtimeQuery = <T,>(key: string, table: string | string[], queryFn: () => Promise<T>, options?: RealtimeQueryOptions) => {
  const queryClient = useQueryClient()
  const tableKey = Array.isArray(table) ? table.join(",") : table
  const enabled = options?.enabled ?? true
  const queryKey = ["aegis", key, ...(options?.queryKey ?? [])]
  const query = useQuery({
    queryKey,
    queryFn,
    enabled: hasSupabase && enabled,
    staleTime: options?.staleTime,
    refetchInterval: options?.refetchInterval,
  })

  useEffect(() => {
    if (!hasSupabase || !enabled) return
    const tables = Array.isArray(table) ? table : [table]
    const channels = tables.map((tableName) => (
      supabase
        .channel(`aegis:${key}:${tableName}`)
        .on("postgres_changes", { event: "*", schema: "public", table: tableName }, () => {
          queryClient.invalidateQueries({ queryKey: ["aegis", key] })
        })
        .subscribe()
    ))
    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel))
    }
  }, [queryClient, key, tableKey, enabled, table])

  return query
}

const fetchRegions = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as RegionData[]
  const query = applyPagination(
    supabase.from("regions").select("id,name,country,risk_level,risk_score,incidents,trend,trend_percent,lat,lng,population,shelters,agents"),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as RegionData[]
    throw error
  }
  return (data ?? []).map((row) => mapRegion(row as Record<string, unknown>))
}

const fetchSystemMetrics = async () => {
  if (!hasSupabase) return null
  const { data, error } = await supabase
    .from("system_metrics")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    if (isMissingTableError(error)) return null
    throw error
  }
  return data ? mapSystemMetrics(data as Record<string, unknown>) : null
}

const fetchAlertsFeed = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as AlertItem[]
  const query = applyPagination(
    supabase
      .from("alerts_feed")
      .select("id,time,type,message,module,created_at")
      .order("created_at", { ascending: false }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as AlertItem[]
    throw error
  }
  return (data ?? []).map((row) => mapAlert(row as Record<string, unknown>))
}

const fetchContinentalStats = async () => {
  if (!hasSupabase) return {} as ContinentalStats
  const { data, error } = await supabase
    .from("continental_stats")
    .select("incidents,risk_score,trend,shelters,agents,region_key,region,id")
  if (error) {
    if (isMissingTableError(error)) return {} as ContinentalStats
    throw error
  }
  return (data ?? []).reduce<ContinentalStats>((acc, row: Record<string, unknown>) => {
    const key = String(row.region_key ?? row.region ?? row.id ?? "")
    if (key) {
      acc[key] = mapContinentalStat(row)
    }
    return acc
  }, {})
}


const fetchRiskTrendData = async () => {
  if (!hasSupabase) return [] as TimeSeriesPoint[]
  const { data, error } = await supabase
    .from("incident_timeseries")
    .select("date,incident_count,predicted_count,lower_bound,upper_bound")
    .order("date", { ascending: true })
  if (error) {
    if (isMissingTableError(error)) return [] as TimeSeriesPoint[]
    throw error
  }
  return (data ?? []).map((row) => {
    const mapped = row as Record<string, unknown>
    return mapTimeSeries({
      date: mapped.date,
      value: mapped.incident_count,
      predicted: mapped.predicted_count,
      lower: mapped.lower_bound,
      upper: mapped.upper_bound,
    })
  })
}

const fetchIncidentTimeSeries = async () => {
  if (!hasSupabase) return [] as TimeSeriesPoint[]
  const { data, error } = await supabase
    .from("incident_timeseries")
    .select("date,incident_count,predicted_count,lower_bound,upper_bound")
    .order("date", { ascending: true })
  if (error) {
    if (isMissingTableError(error)) return [] as TimeSeriesPoint[]
    throw error
  }
  return (data ?? []).map((row) => {
    const mapped = row as Record<string, unknown>
    return mapTimeSeries({
      date: mapped.date,
      value: mapped.incident_count,
      predicted: mapped.predicted_count,
      lower: mapped.lower_bound,
      upper: mapped.upper_bound,
    })
  })
}

const fetchPolicyScenarios = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as PolicyScenario[]
  const query = applyPagination(
    supabase
      .from("policy_scenarios")
      .select("id,name,description,category,impact,cost,timeframe,confidence,gbv_reduction,iterations")
      .order("name", { ascending: true }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as PolicyScenario[]
    throw error
  }
  return (data ?? []).map((row) => mapPolicyScenario(row as Record<string, unknown>))
}

const fetchJusticeCases = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as JusticeCase[]
  const query = applyPagination(
    supabase
      .from("justice_cases")
      .select("id,case_number,type,region,status,days_open,stage,assigned_to,priority")
      .order("days_open", { ascending: false }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as JusticeCase[]
    throw error
  }
  return (data ?? []).map((row) => mapJusticeCase(row as Record<string, unknown>))
}

const fetchFairnessMetrics = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as FairnessMetric[]
  const query = applyPagination(
    supabase
      .from("fairness_metrics")
      .select("metric,score,threshold,status")
      .order("metric", { ascending: true }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as FairnessMetric[]
    throw error
  }
  return (data ?? []).map((row) => mapFairnessMetric(row as Record<string, unknown>))
}

const fetchGovernanceModels = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as GovernanceModel[]
  const query = applyPagination(
    supabase
      .from("governance_models")
      .select("name,version,module,status,accuracy,fairness,drift")
      .order("name", { ascending: true }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as GovernanceModel[]
    throw error
  }
  return (data ?? []).map((row) => mapGovernanceModel(row as Record<string, unknown>))
}

const fetchAuditLogs = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as AuditLog[]
  const query = applyPagination(
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as AuditLog[]
    throw error
  }
  return (data ?? []).map((row) => mapAuditLog(row as Record<string, unknown>))
}

const fetchEscalationReviews = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as EscalationReview[]
  const query = applyPagination(
    supabase
      .from("escalation_reviews")
      .select("id,session_id,risk_level,emotion_detected,status,assigned_to,resolution_summary,created_at,updated_at,resolved_at")
      .order("created_at", { ascending: false }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as EscalationReview[]
    throw error
  }
  return (data ?? []).map((row) => mapEscalationReview(row as Record<string, unknown>))
}

const fetchDeletionRequests = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as DeletionRequest[]
  const query = applyPagination(
    supabase
      .from("data_deletion_requests")
      .select("id,user_id,survivor_id,status,requested_at,processed_at,processed_by,reason")
      .order("requested_at", { ascending: false }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as DeletionRequest[]
    throw error
  }
  return (data ?? []).map((row) => mapDeletionRequest(row as Record<string, unknown>))
}

const fetchUserProfile = async (userId: string) => {
  if (!hasSupabase) return null as UserProfile | null
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,role,full_name,avatar_url,is_active,organization_id,approval_status,mfa_enabled")
    .eq("id", userId)
    .maybeSingle()
  if (error) {
    if (isMissingTableError(error)) return null
    throw error
  }
  return data ? mapUserProfile(data as Record<string, unknown>) : null
}

const fetchUserProfiles = async (options?: FetchOptions & { role?: string }) => {
  if (!hasSupabase) return [] as UserProfile[]
  let query = supabase
    .from("user_profiles")
    .select("id,role,full_name,avatar_url,is_active,organization_id,approval_status,mfa_enabled,created_at")

  if (options?.role) {
    query = query.eq("role", options.role)
  }

  const paginatedQuery = applyPagination(
    query.order("created_at", { ascending: false }),
    options
  )
  const { data, error } = await paginatedQuery
  if (error) {
    if (isMissingTableError(error)) return [] as UserProfile[]
    throw error
  }
  return (data ?? []).map((row) => mapUserProfile(row as Record<string, unknown>))
}

const fetchOrganization = async (organizationId: string) => {
  if (!hasSupabase) return null as Organization | null
  const { data, error } = await supabase
    .from("organizations")
    .select("id,name,type,country,region")
    .eq("id", organizationId)
    .maybeSingle()
  if (error) {
    if (isMissingTableError(error)) return null
    throw error
  }
  return data ? mapOrganization(data as Record<string, unknown>) : null
}

const fetchOrganizations = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as Organization[]
  const query = applyPagination(
    supabase
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as Organization[]
    throw error
  }
  return (data ?? []).map((row) => mapOrganization(row as Record<string, unknown>))
}

const fetchBiasReports = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as BiasReport[]
  const query = applyPagination(
    supabase
      .from("bias_reports")
      .select("model,finding,severity,recommendation")
      .order("model", { ascending: true }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as BiasReport[]
    throw error
  }
  return (data ?? []).map((row) => mapBiasReport(row as Record<string, unknown>))
}

const fetchEthicalConstraints = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as EthicalConstraint[]
  const query = applyPagination(
    supabase
      .from("ethical_constraints")
      .select("name,active")
      .order("name", { ascending: true }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as EthicalConstraint[]
    throw error
  }
  return (data ?? []).map((row) => mapEthicalConstraint(row as Record<string, unknown>))
}

const fetchJusticeConvictions = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as JusticeConviction[]
  const query = applyPagination(
    supabase
      .from("justice_convictions")
      .select("region,rate,cases")
      .order("region", { ascending: true }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as JusticeConviction[]
    throw error
  }
  return (data ?? []).map((row) => mapJusticeConviction(row as Record<string, unknown>))
}

const fetchJusticeBottlenecks = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as JusticeBottleneck[]
  const query = applyPagination(
    supabase
      .from("justice_bottlenecks")
      .select("stage,avg_delay,severity,description")
      .order("avg_delay", { ascending: false }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as JusticeBottleneck[]
    throw error
  }
  return (data ?? []).map((row) => mapJusticeBottleneck(row as Record<string, unknown>))
}

const fetchRegionIncidentTypes = async (regionId: string, options?: FetchOptions) => {
  if (!hasSupabase) return [] as RegionIncidentType[]
  const query = applyPagination(
    supabase
      .from("region_incident_types")
      .select("type,pct")
      .eq("region_id", regionId)
      .order("pct", { ascending: false }),
    options
  )
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRegionIncidentType(row as Record<string, unknown>))
}

const fetchRegionForecasts = async (regionId: string, options?: FetchOptions) => {
  if (!hasSupabase) return [] as RegionForecast[]
  const query = applyPagination(
    supabase
      .from("region_forecasts")
      .select("forecast_days,label,risk_change")
      .eq("region_id", regionId)
      .order("forecast_days", { ascending: true }),
    options
  )
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapRegionForecast(row as Record<string, unknown>))
}

const fetchAnomalyAlerts = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as AnomalyAlert[]
  const query = applyPagination(
    supabase
      .from("anomaly_alerts")
      .select("id,region,type,severity,time")
      .order("time", { ascending: false }),
    options
  )
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((row) => mapAnomalyAlert(row as Record<string, unknown>))
}

export const useRegions = (options?: ListQueryOptions) => useRealtimeQuery(
  "regions",
  "regions",
  () => fetchRegions(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useSystemMetrics = (options?: RealtimeQueryOptions) => useRealtimeQuery(
  "systemMetrics",
  "system_metrics",
  fetchSystemMetrics,
  options
)

export const useAlertsFeed = (options?: ListQueryOptions) => useRealtimeQuery(
  "alertsFeed",
  "alerts_feed",
  () => fetchAlertsFeed(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useContinentalStats = (options?: RealtimeQueryOptions) => useRealtimeQuery(
  "continentalStats",
  "continental_stats",
  fetchContinentalStats,
  options
)

export const useIncidentTimeSeries = (options?: RealtimeQueryOptions) => useRealtimeQuery(
  "incidentTimeSeries",
  "incident_timeseries",
  fetchIncidentTimeSeries,
  options
)

export const useRiskTrendData = (options?: RealtimeQueryOptions) => useRealtimeQuery(
  "riskTrendData",
  "risk_trend_data",
  fetchRiskTrendData,
  options
)

export const usePolicyScenarios = (options?: ListQueryOptions) => useRealtimeQuery(
  "policyScenarios",
  "policy_scenarios",
  () => fetchPolicyScenarios(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useJusticeCases = (options?: ListQueryOptions) => useRealtimeQuery(
  "justiceCases",
  "justice_cases",
  () => fetchJusticeCases(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useFairnessMetrics = (options?: ListQueryOptions) => useRealtimeQuery(
  "fairnessMetrics",
  "fairness_metrics",
  () => fetchFairnessMetrics(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useGovernanceModels = (options?: ListQueryOptions) => useRealtimeQuery(
  "governanceModels",
  "governance_models",
  () => fetchGovernanceModels(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useAuditLogs = (options?: ListQueryOptions) => useRealtimeQuery(
  "auditLogs",
  "audit_logs",
  () => fetchAuditLogs(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useEscalationReviews = (options?: ListQueryOptions) => useRealtimeQuery(
  "escalationReviews",
  "escalation_reviews",
  () => fetchEscalationReviews(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useDeletionRequests = (options?: ListQueryOptions) => useRealtimeQuery(
  "deletionRequests",
  "data_deletion_requests",
  () => fetchDeletionRequests(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useUserProfile = (userId?: string | null) => {
  return useQuery({
    queryKey: ["aegis", "userProfile", userId ?? "none"],
    queryFn: () => (userId ? fetchUserProfile(userId) : Promise.resolve(null)),
    enabled: hasSupabase && Boolean(userId),
  })
}

export const useUserProfiles = (options?: FetchOptions & { role?: string; enabled?: boolean }) => {
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: ["aegis", "userProfiles", options?.role ?? "all", options?.limit ?? "all", options?.offset ?? 0],
    queryFn: () => fetchUserProfiles(options),
    enabled: hasSupabase && enabled,
  })
}

export const usePoliceOfficers = (options?: FetchOptions & { enabled?: boolean }) => {
  return useUserProfiles({ ...options, role: "police" })
}

export const useOrganization = (organizationId?: string | null) => {
  return useQuery({
    queryKey: ["aegis", "organization", organizationId ?? "none"],
    queryFn: () => (organizationId ? fetchOrganization(organizationId) : Promise.resolve(null)),
    enabled: hasSupabase && Boolean(organizationId),
  })
}

export const useOrganizations = (options?: FetchOptions & { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: ["aegis", "organizations", options?.limit ?? "all", options?.offset ?? 0],
    queryFn: () => fetchOrganizations(options),
    enabled: hasSupabase && enabled,
  })
}

export const useBiasReports = (options?: ListQueryOptions) => useRealtimeQuery(
  "biasReports",
  "bias_reports",
  () => fetchBiasReports(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useEthicalConstraints = (options?: ListQueryOptions) => useRealtimeQuery(
  "ethicalConstraints",
  "ethical_constraints",
  () => fetchEthicalConstraints(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useJusticeConvictions = (options?: ListQueryOptions) => useRealtimeQuery(
  "justiceConvictions",
  "justice_convictions",
  () => fetchJusticeConvictions(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useJusticeBottlenecks = (options?: ListQueryOptions) => useRealtimeQuery(
  "justiceBottlenecks",
  "justice_bottlenecks",
  () => fetchJusticeBottlenecks(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

export const useRegionIncidentTypes = (regionId?: string | null, options?: ListQueryOptions) => {
  const enabled = Boolean(regionId) && (options?.enabled ?? true)
  return useRealtimeQuery(
    `regionIncidentTypes:${regionId ?? "none"}`,
    "region_incident_types",
    () => (regionId ? fetchRegionIncidentTypes(regionId, options) : Promise.resolve([] as RegionIncidentType[])),
    { ...options, enabled, queryKey: [regionId ?? "none", options?.limit, options?.offset] }
  )
}

export const useRegionForecasts = (regionId?: string | null, options?: ListQueryOptions) => {
  const enabled = Boolean(regionId) && (options?.enabled ?? true)
  return useRealtimeQuery(
    `regionForecasts:${regionId ?? "none"}`,
    "region_forecasts",
    () => (regionId ? fetchRegionForecasts(regionId, options) : Promise.resolve([] as RegionForecast[])),
    { ...options, enabled, queryKey: [regionId ?? "none", options?.limit, options?.offset] }
  )
}

export const useAnomalyAlerts = (options?: ListQueryOptions) => useRealtimeQuery(
  "anomalyAlerts",
  "anomaly_alerts",
  () => fetchAnomalyAlerts(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

const fetchOrganizationCoordination = async (options?: FetchOptions) => {
  if (!hasSupabase) return [] as OrganizationCoordination[]
  const query = applyPagination(
    supabase
      .from("organization_coordination")
      .select("*")
      .order("created_at", { ascending: false }),
    options
  )
  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return [] as OrganizationCoordination[]
    throw error
  }
  return (data ?? []).map((row) => mapOrganizationCoordination(row as Record<string, unknown>))
}

export const useOrganizationCoordination = (options?: ListQueryOptions) => useRealtimeQuery(
  "organizationCoordination",
  "organization_coordination",
  () => fetchOrganizationCoordination(options),
  { ...options, queryKey: [options?.limit, options?.offset] }
)

const fetchSurvivorProfile = async (userId: string) => {
  if (!hasSupabase) return null as SurvivorProfile | null
  const { data, error } = await supabase
    .from("survivors")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) {
    if (isMissingTableError(error)) return null
    throw error
  }
  return data ? mapSurvivorProfile(data as Record<string, unknown>) : null
}

const fetchSafetyPlan = async (survivorId: string) => {
  if (!hasSupabase) return null as SafetyPlan | null
  const { data, error } = await supabase
    .from("safety_plans")
    .select("*")
    .eq("survivor_id", survivorId)
    .maybeSingle()
  if (error) {
    if (isMissingTableError(error)) return null
    throw error
  }
  return data ? mapSafetyPlan(data as Record<string, unknown>) : null
}

export const useSurvivorProfile = (userId?: string | null) => {
  return useQuery({
    queryKey: ["aegis", "survivorProfile", userId ?? "none"],
    queryFn: () => (userId ? fetchSurvivorProfile(userId) : Promise.resolve(null)),
    enabled: hasSupabase && Boolean(userId),
  })
}

export const useSafetyPlan = (survivorId?: string | null) => {
  return useQuery({
    queryKey: ["aegis", "safetyPlan", survivorId ?? "none"],
    queryFn: () => (survivorId ? fetchSafetyPlan(survivorId) : Promise.resolve(null)),
    enabled: hasSupabase && Boolean(survivorId),
  })
}
