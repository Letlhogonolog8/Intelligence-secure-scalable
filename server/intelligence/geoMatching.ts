/**
 * AEGIS Geo-Matching Intelligence Engine
 * server/intelligence/geoMatching.ts
 * 
 * Intelligent resource assignment using:
 * - Geospatial proximity matching
 * - Capacity and availability scoring
 * - Response time prediction
 * - Workload balancing
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface GeoAssignment {
  resourceId: string;
  resourceType: 'police_station' | 'shelter' | 'counselor' | 'ngo';
  resourceName: string;
  distanceKm: number;
  estimatedResponseMinutes: number;
  capacityScore: number; // 0-100 (higher = more available)
  priorityScore: number; // 0-100 (composite score for selection)
  lat: number;
  lng: number;
  metadata?: any;
}

export interface AssignmentResult {
  primary: GeoAssignment;
  secondary: GeoAssignment[];
  reasoning: string;
}

export class GeoMatchingEngine {
  private supabase: SupabaseClient;
  private readonly EARTH_RADIUS_KM = 6371;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Find optimal resources for a case
   */
  public async assignResources(
    caseId: string,
    lat: number,
    lng: number,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    caseType: string
  ): Promise<AssignmentResult> {
    try {
      // Get all available resources
      const [policeStations, shelters, counselors, ngos] = await Promise.all([
        this.getPoliceStations(),
        this.getShelters(),
        this.getCounselors(),
        this.getNGOs(),
      ]);

      // Score and rank each resource type
      const scoredPolice = await Promise.all(
        policeStations.map((station) =>
          this.scoreResource(station, lat, lng, 'police_station', riskLevel)
        )
      );

      const scoredShelters = await Promise.all(
        shelters.map((shelter) =>
          this.scoreResource(shelter, lat, lng, 'shelter', riskLevel)
        )
      );

      const scoredCounselors = await Promise.all(
        counselors.map((counselor) =>
          this.scoreResource(counselor, lat, lng, 'counselor', riskLevel)
        )
      );

      const scoredNGOs = await Promise.all(
        ngos.map((ngo) => this.scoreResource(ngo, lat, lng, 'ngo', riskLevel))
      );

      // Select best matches
      const bestPolice = scoredPolice.sort((a, b) => b.priorityScore - a.priorityScore)[0];
      const bestShelter = scoredShelters.sort((a, b) => b.priorityScore - a.priorityScore)[0];
      const bestCounselor = scoredCounselors.sort((a, b) => b.priorityScore - a.priorityScore)[0];

      // Primary assignment depends on risk level
      let primary: GeoAssignment;
      const secondaryAssignments: GeoAssignment[] = [];

      if (riskLevel === 'critical') {
        // Critical: Police first, with shelter and counselor support
        primary = bestPolice;
        if (bestShelter) secondaryAssignments.push(bestShelter);
        if (bestCounselor) secondaryAssignments.push(bestCounselor);
      } else if (riskLevel === 'high') {
        // High: Balanced approach
        primary = bestCounselor;
        if (bestPolice) secondaryAssignments.push(bestPolice);
        if (bestShelter) secondaryAssignments.push(bestShelter);
      } else {
        // Medium/Low: Counselor primary
        primary = bestCounselor;
        if (bestShelter) secondaryAssignments.push(bestShelter);
      }

      // Record assignments in database
      await this.recordAssignments(caseId, primary, secondaryAssignments);

      const reasoning = this.generateAssignmentReasoning(primary, secondaryAssignments, riskLevel);

      return {
        primary,
        secondary: secondaryAssignments,
        reasoning,
      };
    } catch (error) {
      console.error('Geo-matching failed:', error);
      throw error;
    }
  }

  /**
   * Score a resource based on multiple factors
   */
  private async scoreResource(
    resource: any,
    incidentLat: number,
    incidentLng: number,
    resourceType: string,
    riskLevel: string
  ): Promise<GeoAssignment> {
    // Distance scoring (closer = better)
    const distanceKm = this.calculateDistance(incidentLat, incidentLng, resource.lat, resource.lng);
    const distanceScore = Math.max(0, 100 - distanceKm * 5); // Degrades by 5 points per km

    // Capacity scoring
    const { capacity, utilization } = await this.getCapacityMetrics(resource.id, resourceType);
    const capacityScore = Math.max(0, 100 - utilization);

    // Response time prediction
    const estimatedResponseMinutes = this.predictResponseTime(distanceKm, resourceType);
    const responseScore = Math.max(0, 100 - estimatedResponseMinutes);

    // Availability bonus
    const availabilityBonus = capacity > 0 ? 10 : 0;

    // Risk-aware weighting
    const weights = this.getWeights(resourceType, riskLevel);

    const priorityScore = Math.round(
      distanceScore * weights.distance +
        capacityScore * weights.capacity +
        responseScore * weights.response +
        availabilityBonus
    );

    return {
      resourceId: resource.id,
      resourceType: resourceType as any,
      resourceName: resource.name,
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      estimatedResponseMinutes,
      capacityScore,
      priorityScore,
      lat: resource.lat,
      lng: resource.lng,
      metadata: {
        utilization,
        capacity,
      },
    };
  }

  /**
   * Calculate Haversine distance between two coordinates
   */
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

  /**
   * Get capacity metrics for a resource
   */
  private async getCapacityMetrics(
    resourceId: string,
    resourceType: string
  ): Promise<{ capacity: number; utilization: number }> {
    try {
      const { data } = await this.supabase
        .from('resource_capacity')
        .select('available_capacity, total_capacity, current_load')
        .eq('resource_id', resourceId)
        .eq('resource_type', resourceType)
        .single();

      if (!data) {
        return { capacity: 1, utilization: 0 }; // Default: available
      }

      const utilization = (data.current_load / data.total_capacity) * 100;

      return {
        capacity: data.available_capacity,
        utilization,
      };
    } catch (error) {
      console.error('Capacity metrics retrieval failed:', error);
      return { capacity: 1, utilization: 50 }; // Default middle-ground
    }
  }

  /**
   * Predict response time based on distance and resource type
   */
  private predictResponseTime(distanceKm: number, resourceType: string): number {
    // Base response times (minutes)
    const baseResponseTimes = {
      police_station: 15,
      shelter: 30,
      counselor: 45,
      ngo: 60,
    };

    const baseTime = baseResponseTimes[resourceType as keyof typeof baseResponseTimes] || 60;

    // Add time based on distance (assume 40 km/h average speed)
    const travelTime = (distanceKm / 40) * 60; // Convert to minutes

    // Random delay factor (0-5 minutes)
    const delayFactor = Math.random() * 5;

    return Math.round(baseTime + travelTime + delayFactor);
  }

  /**
   * Get weighting for scoring based on context
   */
  private getWeights(
    resourceType: string,
    riskLevel: string
  ): { distance: number; capacity: number; response: number } {
    if (riskLevel === 'critical') {
      return {
        distance: 0.5, // Distance is critical
        capacity: 0.2,
        response: 0.3, // Fast response is critical
      };
    }

    if (riskLevel === 'high') {
      return {
        distance: 0.4,
        capacity: 0.35,
        response: 0.25,
      };
    }

    // Medium/Low
    return {
      distance: 0.3,
      capacity: 0.5, // Prefer available resources
      response: 0.2,
    };
  }

  /**
   * Retrieve police stations
   */
  private async getPoliceStations(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('police_stations')
      .select('id, name, lat, lng, region');

    if (error) {
      console.error('Failed to fetch police stations:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Retrieve shelters
   */
  private async getShelters(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('shelters')
      .select('id, name, lat, lng, region');

    if (error) {
      console.error('Failed to fetch shelters:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Retrieve available counselors
   */
  private async getCounselors(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, full_name, lat, lng')
      .eq('role', 'counselor')
      .eq('is_available', true);

    if (error) {
      console.error('Failed to fetch counselors:', error);
      return [];
    }

    return (data || []).map((c) => ({
      ...c,
      name: c.full_name,
    }));
  }

  /**
   * Retrieve NGO organizations
   */
  private async getNGOs(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('organizations')
      .select('id, name, lat, lng')
      .eq('type', 'ngo')
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch NGOs:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Record assignments in database
   */
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
        capacity_utilization: assignment.metadata?.utilization || 0,
        assignment_reason: assignment === primary ? 'PRIMARY' : 'SECONDARY',
      }))
    );

    if (error) {
      console.error('Failed to record geo-assignments:', error);
      throw error;
    }
  }

  /**
   * Generate human-readable reasoning for assignments
   */
  private generateAssignmentReasoning(
    primary: GeoAssignment,
    secondary: GeoAssignment[],
    riskLevel: string
  ): string {
    return `
Primary Assignment: ${primary.resourceName} (${primary.resourceType})
- Distance: ${primary.distanceKm}km
- Estimated Response: ${primary.estimatedResponseMinutes} minutes
- Available Capacity: ${primary.metadata?.capacity} units

Secondary Assignments: ${secondary.map((s) => s.resourceName).join(', ') || 'None'}

Risk Level: ${riskLevel}
Assignment Strategy: ${this.getStrategyName(riskLevel)}
    `.trim();
  }

  private getStrategyName(riskLevel: string): string {
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
