/**
 * South Africa Infrastructure & Geolocation Routing
 * src/lib/geo/southAfricaRouting.ts
 *
 * Implements South African data residency and optimal routing
 */

export interface ServerConfig {
  server: string;
  region: string;
  latency_expected: string;
  country: string;
  primary: boolean;
}

export interface GeoLocation {
  ip: string;
  country: string;
  country_code: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
}

export const DOMAIN_CONFIG = {
  primary: 'aegis-ai.co.za',
  registrar: 'ZACR',
  nameservers: ['ns1.sa-host.co.za', 'ns2.sa-host.co.za'],
  dns_provider: 'Route53 (AWS)',
  tld: '.co.za',
};

export const SA_REGIONS = {
  'af-south-1': {
    name: 'Cape Town',
    provider: 'AWS',
    provinces: [
      'Western Cape',
      'Northern Cape',
    ],
    latency_ms: 10,
    backup_region: 'eu-west-1',
  },
  'af-south-2': {
    name: 'Johannesburg',
    provider: 'AWS',
    provinces: [
      'Gauteng',
      'North West',
      'Limpopo',
    ],
    latency_ms: 10,
    backup_region: 'eu-west-1',
  },
  'af-south-3': {
    name: 'Durban',
    provider: 'AWS',
    provinces: [
      'KwaZulu-Natal',
      'Mpumalanga',
      'Free State',
    ],
    latency_ms: 10,
    backup_region: 'eu-west-1',
  },
};

export const INTERNATIONAL_REGIONS = {
  'eu-west-1': {
    name: 'Ireland (EU)',
    provider: 'AWS',
    latency_ms: 150,
    backup_region: 'af-south-1',
  },
  'us-east-1': {
    name: 'N. Virginia (USA)',
    provider: 'AWS',
    latency_ms: 250,
    backup_region: 'eu-west-1',
  },
};

export const SA_PROVINCES = {
  'Eastern Cape': { region: 'af-south-3', province_code: 'EC' },
  'Free State': { region: 'af-south-3', province_code: 'FS' },
  Gauteng: { region: 'af-south-2', province_code: 'GP' },
  'KwaZulu-Natal': { region: 'af-south-3', province_code: 'KN' },
  Limpopo: { region: 'af-south-2', province_code: 'LP' },
  Mpumalanga: { region: 'af-south-3', province_code: 'MP' },
  'Northern Cape': { region: 'af-south-1', province_code: 'NC' },
  'North West': { region: 'af-south-2', province_code: 'NW' },
  'Western Cape': { region: 'af-south-1', province_code: 'WC' },
};

export const ISP_CONFIG = {
  preferred_order: [
    { name: 'Vodacom', weight: 0.4 },
    { name: 'Telkom', weight: 0.4 },
    { name: 'Cell C', weight: 0.1 },
    { name: 'Rain', weight: 0.1 },
  ],
  failover_strategy: 'round-robin',
  health_check_interval_seconds: 30,
  bandwidth_reserve_percent: 20,
};

export class SouthAfricaRouting {
  /**
   * Resolve optimal server based on client IP geolocation
   */
  async resolveOptimalServer(clientIp: string): Promise<ServerConfig> {
    try {
      const location = await this.geolocateClient(clientIp);

      if (location.country_code !== 'ZA') {
        return {
          server: 'https://global-api.aegis-ai.co.za',
          region: 'eu-west-1',
          latency_expected: '< 150ms',
          country: location.country,
          primary: false,
        };
      }

      const province = location.region;
      const provinceConfig = SA_PROVINCES[province as keyof typeof SA_PROVINCES];

      if (!provinceConfig) {
        return {
          server: 'https://sa-api.aegis-ai.co.za',
          region: 'af-south-2',
          latency_expected: '< 50ms',
          country: 'ZA',
          primary: true,
        };
      }

      const regionConfig = SA_REGIONS[provinceConfig.region as keyof typeof SA_REGIONS];

      return {
        server: `https://${provinceConfig.region}-api.aegis-ai.co.za`,
        region: provinceConfig.region,
        latency_expected: `< ${regionConfig.latency_ms}ms`,
        country: 'ZA',
        primary: true,
      };
    } catch (_error) {
      return {
        server: 'https://sa-api.aegis-ai.co.za',
        region: 'af-south-1',
        latency_expected: '< 100ms',
        country: 'ZA',
        primary: true,
      };
    }
  }

  /**
   * Geolocate client IP address
   */
  private async geolocateClient(ip: string): Promise<GeoLocation> {
    try {
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      const data = (await response.json()) as Record<string, unknown>;

      return {
        ip: ip,
        country: data.country_name as string || 'Unknown',
        country_code: data.country_code as string || 'XX',
        region: data.region as string || 'Unknown',
        city: data.city as string || 'Unknown',
        latitude: (data.latitude as number) || 0,
        longitude: (data.longitude as number) || 0,
      };
    } catch (_error) {
      return {
        ip: ip,
        country: 'Unknown',
        country_code: 'XX',
        region: 'Unknown',
        city: 'Unknown',
        latitude: 0,
        longitude: 0,
      };
    }
  }

  /**
   * Get optimal region for province
   */
  getRegionForProvince(province: string): string {
    const config = SA_PROVINCES[province as keyof typeof SA_PROVINCES];
    return config?.region || 'af-south-1';
  }

  /**
   * Calculate distance between coordinates (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Find nearest SA data center
   */
  async findNearestDataCenter(
    latitude: number,
    longitude: number
  ): Promise<{ region: string; distance_km: number }> {
    const dataCenters = [
      { region: 'af-south-1', lat: -33.9249, lon: 18.4241 },
      { region: 'af-south-2', lat: -26.2023, lon: 28.0436 },
      { region: 'af-south-3', lat: -29.8587, lon: 31.0292 },
    ];

    let nearest = dataCenters[0];
    let minDistance = this.calculateDistance(
      latitude,
      longitude,
      dataCenters[0].lat,
      dataCenters[0].lon
    );

    for (const dc of dataCenters.slice(1)) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        dc.lat,
        dc.lon
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearest = dc;
      }
    }

    return {
      region: nearest.region,
      distance_km: Math.round(minDistance * 10) / 10,
    };
  }

  /**
   * Check data residency compliance
   */
  async checkDataResidency(region: string): Promise<{
    compliant: boolean;
    message: string;
  }> {
    const saDcRegions = Object.keys(SA_REGIONS);

    if (!saDcRegions.includes(region)) {
      return {
        compliant: false,
        message: `Data must be in South African region. Got: ${region}. Use: ${saDcRegions.join(', ')}`,
      };
    }

    return {
      compliant: true,
      message: `Data residency compliant. Using SA region: ${region}`,
    };
  }

  /**
   * Get failover server configuration
   */
  getFailoverConfig(primaryRegion: string): ServerConfig {
    const regionConfig = SA_REGIONS[primaryRegion as keyof typeof SA_REGIONS];

    if (!regionConfig) {
      return {
        server: 'https://eu-api.aegis-ai.co.za',
        region: 'eu-west-1',
        latency_expected: '< 150ms',
        country: 'EU',
        primary: false,
      };
    }

    return {
      server: `https://${regionConfig.backup_region}-api.aegis-ai.co.za`,
      region: regionConfig.backup_region,
      latency_expected: '< 150ms',
      country: 'EU',
      primary: false,
    };
  }

  /**
   * Get CDN configuration for South Africa
   */
  getCDNConfig() {
    return {
      provider: 'CloudFront (AWS)',
      origins: {
        primary: {
          domain: 'sa-api.aegis-ai.co.za',
          regions: ['af-south-1', 'af-south-2', 'af-south-3'],
        },
        failover: {
          domain: 'eu-api.aegis-ai.co.za',
          region: 'eu-west-1',
        },
      },
      caching: {
        ttl_seconds: 300,
        compression: 'gzip',
        http_versions: ['HTTP/2', 'HTTP/3'],
      },
      security: {
        ssl_protocol: 'TLSv1.3',
        certificate_provider: 'AWS Certificate Manager',
        auto_renewal: true,
      },
    };
  }

  /**
   * Validate latency SLA
   */
  async validateLatencySLA(): Promise<{
    compliant: boolean;
    measurements: Array<{ region: string; latency_ms: number }>;
  }> {
    const measurements = [];
    const slaTarget = 200;

    for (const [region] of Object.entries(SA_REGIONS)) {
      const startTime = performance.now();

      try {
        await fetch(`https://${region}-api.aegis-ai.co.za/health`, {
          method: 'HEAD',
        });
        const latency = Math.round(performance.now() - startTime);

        measurements.push({
          region,
          latency_ms: latency,
        });
      } catch {
        measurements.push({
          region,
          latency_ms: 5000,
        });
      }
    }

    const compliant = measurements.every((m) => m.latency_ms <= slaTarget);

    return { compliant, measurements };
  }
}

export const southAfricaRouting = new SouthAfricaRouting();
