import { SupabaseClient } from '@supabase/supabase-js';

export type ResourceType = 'police_station' | 'shelter' | 'counselor' | 'ngo';

export interface ResourceMetadata {
  utilization?: number;
  capacity?: number;
  region?: string | null;
}

export interface GeoAssignment {
  resourceId: string;
  resourceType: ResourceType;
  resourceName: string;
  distanceKm: number;
  estimatedResponseMinutes: number;
  capacityScore: number;
  priorityScore: number;
  lat: number;
  lng: number;
  metadata?: ResourceMetadata;
}

export interface AssignmentResult {
  primary: GeoAssignment;
  secondary: GeoAssignment[];
  reasoning: string;
}

interface ResourceRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region?: string | null;
}

interface CapacityRecord {
  available_capacity?: number | null;
  total_capacity?: number | null;
  current_load?: number | null;
}

export class GeoMatchingEngine {
  private supabase: SupabaseClient;
  private readonly EARTH_RADIUS_KM = 6371;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  public async assignResources(
    caseId: string,
    lat: number,
    lng: number,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    _caseType: string
  ): Promise<AssignmentResult> {
    try {
      const [policeStations, shelters, counselors, ngos] = await Promise.all([
        this.getPoliceStations(),
        this.getShelters(),
        this.getCounselors(),
        this.getNGOs(),
      ]);

      const [scoredPolice, scoredShelters, scoredCounselors, scoredNGOs] = await Promise.all([
        Promise.all(policeStations.map((station) => this.scoreResource(station, lat, lng, 'police_station', riskLevel))),
        Promise.all(shelters.map((shelter) => this.scoreResource(shelter, lat, lng, 'shelter', riskLevel))),
        Promise.all(counselors.map((counselor) => this.scoreResource(counselor, lat, lng, 'counselor', riskLevel))),
        Promise.all(ngos.map((ngo) => this.scoreResource(ngo, lat, lng, 'ngo', riskLevel))),
      ]);

      const bestPolice = this.pickTopAssignment(scoredPolice);
      const bestShelter = this.pickTopAssignment(scoredShelters);
      const bestCounselor = this.pickTopAssignment(scoredCounselors);
      const bestNGO = this.pickTopAssignment(scoredNGOs);

      const secondaryAssignments: GeoAssignment[] = [];
      let primary: GeoAssignment | undefined;

      if (riskLevel === 'critical') {
        primary = bestPolice ?? bestCounselor ?? bestShelter ?? bestNGO;
        if (bestShelter) secondaryAssignments.push(bestShelter);
        if (bestCounselor) secondaryAssignments.push(bestCounselor);
        if (bestNGO) secondaryAssignments.push(bestNGO);
      } else if (riskLevel === 'high') {
        primary = bestCounselor ?? bestPolice ?? bestShelter ?? bestNGO;
        if (bestPolice) secondaryAssignments.push(bestPolice);
        if (bestShelter) secondaryAssignments.push(bestShelter);
        if (bestNGO) secondaryAssignments.push(bestNGO);
      } else {
        primary = bestCounselor ?? bestShelter ?? bestNGO ?? bestPolice;
        if (bestShelter) secondaryAssignments.push(bestShelter);
        if (bestNGO) secondaryAssignments.push(bestNGO);
      }

      if (!primary) {
        throw new Error('No eligible resources available for assignment');
      }

      const deduplicatedSecondary = secondaryAssignments.filter(
        (assignment) => assignment.resourceId !== primary.resourceId
      );

      await this.recordAssignments(caseId, primary, deduplicatedSecondary);

      return {
        primary,
        secondary: deduplicatedSecondary,
        reasoning: this.generateAssignmentReasoning(primary, deduplicatedSecondary, riskLevel),
      };
    } catch (error) {
      console.error('Geo-matching failed:', error);
      throw error;
    }
  }

  private pickTopAssignment(assignments: GeoAssignment[]): GeoAssignment | undefined {
    return [...assignments].sort((a, b) => b.priorityScore - a.priorityScore)[0];
  }

  private async scoreResource(
    resource: ResourceRecord,
    incidentLat: number,
    incidentLng: number,
    resourceType: ResourceType,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<GeoAssignment> {
    const distanceKm = this.calculateDistance(incidentLat, incidentLng, resource.lat, resource.lng);
    const distanceScore = Math.max(0, 100 - distanceKm * 5);

    const { capacity, utilization } = await this.getCapacityMetrics(resource.id, resourceType);
    const capacityScore = Math.max(0, 100 - utilization);

    const estimatedResponseMinutes = this.predictResponseTime(distanceKm, resourceType);
    const responseScore = Math.max(0, 100 - estimatedResponseMinutes);
    const availabilityBonus = capacity > 0 ? 10 : 0;
    const weights = this.getWeights(resourceType, riskLevel);

    const priorityScore = Math.round(
      distanceScore * weights.distance +
        capacityScore * weights.capacity +
        responseScore * weights.response +
        availabilityBonus
    );

    return {
      resourceId: resource.id,
      resourceType,
      resourceName: resource.name,
      distanceKm: Number(distanceKm.toFixed(2)),
      estimatedResponseMinutes,
      capacityScore,
      priorityScore,
      lat: resource.lat,
      lng: resource.lng,
      metadata: {
        utilization,
        capacity,
        region: resource.region,
      },
    };
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_KM * c;
  }

  private async getCapacityMetrics(
    resourceId: string,
    resourceType: ResourceType
  ): Promise<{ capacity: number; utilization: number }> {
    try {
      const { data } = await this.supabase
        .from('resource_capacity')
        .select('available_capacity, total_capacity, current_load')
        .eq('resource_id', resourceId)
        .eq('resource_type', resourceType)
        .single<CapacityRecord>();

      if (!data) {
        return { capacity: 1, utilization: 0 };
      }

      const totalCapacity = Math.max(1, data.total_capacity ?? 1);
      const currentLoad = data.current_load ?? 0;
      const utilization = (currentLoad / totalCapacity) * 100;

      return {
        capacity: data.available_capacity ?? 1,
        utilization,
      };
    } catch (error) {
      console.error('Capacity metrics retrieval failed:', error);
      return { capacity: 1, utilization: 50 };
    }
  }

  private predictResponseTime(distanceKm: number, resourceType: ResourceType): number {
    const baseResponseTimes: Record<ResourceType, number> = {
      police_station: 15,
      shelter: 30,
      counselor: 45,
      ngo: 60,
    };

    const baseTime = baseResponseTimes[resourceType] ?? 60;
    const travelTime = (distanceKm / 40) * 60;
    const delayFactor = Math.random() * 5;

    return Math.round(baseTime + travelTime + delayFactor);
  }

  private getWeights(
    _resourceType: ResourceType,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): { distance: number; capacity: number; response: number } {
    if (riskLevel === 'critical') {
      return {
        distance: 0.5,
        capacity: 0.2,
        response: 0.3,
      };
    }

    if (riskLevel === 'high') {
      return {
        distance: 0.4,
        capacity: 0.35,
        response: 0.25,
      };
    }

    return {
      distance: 0.3,
      capacity: 0.5,
      response: 0.2,
    };
  }

  private async getPoliceStations(): Promise<ResourceRecord[]> {
    const { data, error } = await this.supabase
      .from('police_stations')
      .select('id, name, lat, lng, region');

    if (error) {
      console.error('Failed to fetch police stations:', error);
      return [];
    }

    return (data ?? []) as ResourceRecord[];
  }

  private async getShelters(): Promise<ResourceRecord[]> {
    const { data, error } = await this.supabase
      .from('shelters')
      .select('id, name, lat, lng, region');

    if (error) {
      console.error('Failed to fetch shelters:', error);
      return [];
    }

    return (data ?? []) as ResourceRecord[];
  }

  private async getCounselors(): Promise<ResourceRecord[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, full_name, lat, lng')
      .eq('role', 'counselor')
      .eq('is_available', true);

    if (error) {
      console.error('Failed to fetch counselors:', error);
      return [];
    }

    return (data ?? []).map((counselor) => ({
      id: counselor.id,
      name: counselor.full_name,
      lat: counselor.lat,
      lng: counselor.lng,
    })) as ResourceRecord[];
  }

  private async getNGOs(): Promise<ResourceRecord[]> {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('id, name, lat, lng')
      .eq('type', 'ngo')
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch NGOs:', error);
      return [];
    }

    return (data ?? []) as ResourceRecord[];
  }

  private async recordAssignments(
    caseId: string,
    primary: GeoAssignment,
    secondary: GeoAssignment[]
  ): Promise<void> {
    const assignments = [primary, ...secondary];

    const { error } = await this.supabase.from('geo_assignments').insert(
      assignments.map((assignment) => ({
        case_id: caseId,
        assigned_to: assignment.resourceId,
        resource_type: assignment.resourceType,
        location_lat: assignment.lat,
        location_lng: assignment.lng,
        distance_km: assignment.distanceKm,
        estimated_response_time_minutes: assignment.estimatedResponseMinutes,
        capacity_utilization: assignment.metadata?.utilization ?? 0,
        assignment_reason: assignment.resourceId === primary.resourceId ? 'PRIMARY' : 'SECONDARY',
      }))
    );

    if (error) {
      console.error('Failed to record geo-assignments:', error);
      throw error;
    }
  }

  private generateAssignmentReasoning(
    primary: GeoAssignment,
    secondary: GeoAssignment[],
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): string {
    return `
Primary Assignment: ${primary.resourceName} (${primary.resourceType})
- Distance: ${primary.distanceKm}km
- Estimated Response: ${primary.estimatedResponseMinutes} minutes
- Available Capacity: ${primary.metadata?.capacity ?? 0} units

Secondary Assignments: ${secondary.map((assignment) => assignment.resourceName).join(', ') || 'None'}

Risk Level: ${riskLevel}
Assignment Strategy: ${this.getStrategyName(riskLevel)}
    `.trim();
  }

  private getStrategyName(riskLevel: 'low' | 'medium' | 'high' | 'critical'): string {
    switch (riskLevel) {
      case 'critical':
        return 'Emergency Response (Police prioritized)';
      case 'high':
        return 'Multi-Agency Coordination (Balanced)';
      case 'medium':
        return 'Standard Case Processing';
      default:
        return 'Non-urgent Processing';
    }
  }
}

export default GeoMatchingEngine;
