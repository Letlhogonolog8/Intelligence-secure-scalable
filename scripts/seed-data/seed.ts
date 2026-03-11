import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("❌ Missing VITE_SUPABASE_URL in environment");
  console.error("   Add to .env: VITE_SUPABASE_URL=https://your-project.supabase.co");
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY in environment");
  console.error("   Add to .env: SUPABASE_SERVICE_ROLE_KEY=your_service_role_key");
  console.error("   Get this from: Supabase Dashboard → Settings → API Keys");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const adminUsername = "Admin";
const adminPassword = "admin001!";
const adminEmail = `${adminUsername.toLowerCase()}@aegis.example`;

async function ensureAdminUser() {
  console.log("🔐 Ensuring admin user...");
  const { data: existing, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    throw new Error(`Error checking admin user: ${listError.message}`);
  }
  const existingAdmin = existing?.users?.find(
    (user) => user.email?.toLowerCase() === adminEmail
  );
  let adminUserId = existingAdmin?.id;
  if (!adminUserId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(error?.message || "Unable to create admin user");
    }
    adminUserId = data.user.id;
  } else {
    const { error } = await supabase.auth.admin.updateUserById(adminUserId, {
      password: adminPassword,
      email_confirm: true,
    });
    if (error) {
      throw new Error(error.message || "Unable to update admin user");
    }
  }
  const { error: profileError } = await supabase.from("user_profiles").upsert({
    id: adminUserId,
    role: "admin",
    full_name: adminUsername,
    is_active: true,
  });
  if (profileError) {
    throw new Error(`Error updating admin profile: ${profileError.message}`);
  }
  console.log("✅ Admin user ready");
}

type RegionSeed = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

interface SeedOptions {
  clear?: boolean;
}

async function seedOrganizations() {
  console.log("🏢 Seeding organizations...");

  const organizations = [
    {
      name: "UN Women",
      country: "Global",
      region: "Africa",
      type: "government",
      contact_email: "contact@unwomen.org",
      phone: "+1-212-963-1234",
    },
    {
      name: "Kenya Women Police Officers",
      country: "Kenya",
      region: "East Africa",
      type: "law_enforcement",
      contact_email: "kwpo@police.go.ke",
      phone: "+254-20-2726000",
    },
    {
      name: "South African Medical Research Council",
      country: "South Africa",
      region: "Southern Africa",
      type: "health",
      contact_email: "contact@mrc.ac.za",
      phone: "+27-21-938-0911",
    },
    {
      name: "Kenyan Red Cross",
      country: "Kenya",
      region: "East Africa",
      type: "ngo",
      contact_email: "info@krc.or.ke",
      phone: "+254-20-6998000",
    },
  ];

  const { data, error } = await supabase
    .from("organizations")
    .upsert(organizations, { onConflict: "name" })
    .select();

  if (error) {
    throw new Error(`Error seeding organizations: ${error.message}`);
  }

  console.log(`   ✅ Created ${data?.length || 0} organizations`);
  return data || [];
}

async function seedRegions(): Promise<RegionSeed[]> {
  console.log("🌍 Seeding regions...");

  const regions: Array<{
    name: string;
    country: string;
    region: string;
    risk_level: string;
    risk_score: number;
    incidents: number;
    trend: string;
    trend_percent: number;
    latitude: number;
    longitude: number;
    population: number;
    active_shelters: number;
    active_agents: number;
  }> = [
    {
      name: "Nairobi",
      country: "Kenya",
      region: "East Africa",
      risk_level: "high",
      risk_score: 7.2,
      incidents: 145,
      trend: "up",
      trend_percent: 12.5,
      latitude: -1.2921,
      longitude: 36.8219,
      population: 4000000,
      active_shelters: 12,
      active_agents: 45,
    },
    {
      name: "Cape Town",
      country: "South Africa",
      region: "Southern Africa",
      risk_level: "high",
      risk_score: 6.8,
      incidents: 89,
      trend: "stable",
      trend_percent: 0.0,
      latitude: -33.9249,
      longitude: 18.4241,
      population: 3740000,
      active_shelters: 18,
      active_agents: 52,
    },
    {
      name: "Addis Ababa",
      country: "Ethiopia",
      region: "East Africa",
      risk_level: "medium",
      risk_score: 5.5,
      incidents: 67,
      trend: "down",
      trend_percent: -8.2,
      latitude: 9.0265,
      longitude: 38.7469,
      population: 5000000,
      active_shelters: 8,
      active_agents: 30,
    },
    {
      name: "Lagos",
      country: "Nigeria",
      region: "West Africa",
      risk_level: "critical",
      risk_score: 8.1,
      incidents: 234,
      trend: "up",
      trend_percent: 18.5,
      latitude: 6.5244,
      longitude: 3.3792,
      population: 15000000,
      active_shelters: 15,
      active_agents: 65,
    },
    {
      name: "Kampala",
      country: "Uganda",
      region: "East Africa",
      risk_level: "high",
      risk_score: 6.9,
      incidents: 98,
      trend: "up",
      trend_percent: 5.3,
      latitude: 0.3476,
      longitude: 32.5825,
      population: 1659600,
      active_shelters: 6,
      active_agents: 25,
    },
    {
      name: "Dar es Salaam",
      country: "Tanzania",
      region: "East Africa",
      risk_level: "medium",
      risk_score: 5.2,
      incidents: 54,
      trend: "stable",
      trend_percent: 0.0,
      latitude: -6.8,
      longitude: 39.2833,
      population: 5857000,
      active_shelters: 7,
      active_agents: 20,
    },
  ];

  const { data, error } = await supabase
    .from("regions")
    .upsert(regions, { onConflict: "name" })
    .select();

  if (error) {
    console.error("Error seeding regions:", error);
  } else {
    console.log(`✅ Created ${data?.length || 0} regions`);
  }

  return data || [];
}

async function seedIncidents(
  regions: RegionSeed[],
): Promise<Array<{ id: string }>> {
  console.log("📋 Seeding incidents...");

  const incidentTypes = [
    "physical",
    "sexual",
    "emotional",
    "economic",
    "digital",
  ];
  const severities = ["minor", "moderate", "severe", "critical"];
  const incidents: Array<{
    region_id: string;
    incident_type: string;
    description: string;
    severity: string;
    anonymous: boolean;
    latitude: number;
    longitude: number;
    incident_date: string;
  }> = [];

  // Generate 100 sample incidents
  for (let i = 0; i < 100; i += 1) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const daysAgo = Math.floor(Math.random() * 90);
    const incidentDate = new Date();
    incidentDate.setDate(incidentDate.getDate() - daysAgo);

    incidents.push({
      region_id: region.id,
      incident_type:
        incidentTypes[Math.floor(Math.random() * incidentTypes.length)],
      description: "GBV incident report (confidential details stored separately)",
      severity: severities[Math.floor(Math.random() * severities.length)],
      anonymous: true,
      latitude: region.latitude + (Math.random() - 0.5) * 0.5,
      longitude: region.longitude + (Math.random() - 0.5) * 0.5,
      incident_date: incidentDate.toISOString(),
    });
  }

  const { data, error } = await supabase
    .from("incidents")
    .upsert(incidents)
    .select();

  if (error) {
    console.error("Error seeding incidents:", error);
  } else {
    console.log(`✅ Created ${data?.length || 0} incidents`);
  }

  return data || [];
}

async function seedPolicies() {
  console.log("📜 Seeding policy scenarios...");

  const policies = [
    {
      name: "Mandatory Training for Law Enforcement",
      description:
        "Comprehensive GBV training for all police officers on trauma-informed approaches",
      category: "prevention",
      impact_score: 7.5,
      estimated_cost: "$2.5M annually",
      timeframe: "6-12 months",
      confidence: 0.85,
      gbv_reduction_percent: 15.2,
      iterations: 5000,
    },
    {
      name: "Establish Mobile Clinic Services",
      description:
        "Mobile healthcare units for survivors in underserved areas",
      category: "support",
      impact_score: 6.8,
      estimated_cost: "$1.8M",
      timeframe: "3-6 months",
      confidence: 0.78,
      gbv_reduction_percent: 12.5,
      iterations: 4200,
    },
    {
      name: "School-Based Prevention Programs",
      description:
        "Gender equality and healthy relationships education in schools",
      category: "prevention",
      impact_score: 8.2,
      estimated_cost: "$3.2M over 3 years",
      timeframe: "12-24 months",
      confidence: 0.82,
      gbv_reduction_percent: 18.7,
      iterations: 6100,
    },
    {
      name: "Fast-Track Justice System",
      description:
        "Expedited court processes for GBV cases with specialized judges",
      category: "prosecution",
      impact_score: 7.9,
      estimated_cost: "$1.2M annually",
      timeframe: "3-9 months",
      confidence: 0.88,
      gbv_reduction_percent: 22.3,
      iterations: 5800,
    },
    {
      name: "Community Awareness Campaigns",
      description:
        "Multi-media GBV awareness and bystander intervention campaigns",
      category: "prevention",
      impact_score: 6.5,
      estimated_cost: "$900K",
      timeframe: "2-4 months",
      confidence: 0.72,
      gbv_reduction_percent: 9.8,
      iterations: 3500,
    },
  ];

  const { data, error } = await supabase
    .from("policy_scenarios")
    .upsert(policies, { onConflict: "name" })
    .select();

  if (error) {
    console.error("Error seeding policies:", error);
  } else {
    console.log(`✅ Created ${data?.length || 0} policy scenarios`);
  }

  return data || [];
}

async function seedJusticeCases(
  regions: RegionSeed[],
): Promise<Array<{ id: string }>> {
  console.log("⚖️ Seeding justice cases...");

  const caseTypes = [
    "domestic_violence",
    "sexual_assault",
    "harassment",
    "human_trafficking",
  ];
  const statuses = [
    "open",
    "investigation",
    "prosecution",
    "trial",
    "verdict",
    "closed",
  ];
  const priorities = ["low", "medium", "high", "critical"];
  const cases: Array<{
    case_number: string;
    case_type: string;
    region_id: string;
    status: string;
    priority: string;
    days_open: number;
    created_at: string;
  }> = [];

  for (let i = 0; i < 50; i += 1) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const daysOpen = Math.floor(Math.random() * 365);
    const createdDate = new Date();
    createdDate.setDate(createdDate.getDate() - daysOpen);

    cases.push({
      case_number: `CASE-${Date.now()}-${i}`,
      case_type: caseTypes[Math.floor(Math.random() * caseTypes.length)],
      region_id: region.id,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      days_open: daysOpen,
      created_at: createdDate.toISOString(),
    });
  }

  const { data, error } = await supabase
    .from("justice_cases")
    .insert(cases)
    .select();

  if (error) {
    console.error("Error seeding justice cases:", error);
  } else {
    console.log(`✅ Created ${data?.length || 0} justice cases`);
  }

  return data || [];
}

async function seedResources(
  regions: RegionSeed[],
): Promise<Array<{ id: string }>> {
  console.log("🏥 Seeding resources...");

  const resourceTypes = [
    "shelter",
    "hotline",
    "counselor",
    "legal_aid",
    "medical",
  ];
  const resources: Array<{
    region_id: string;
    resource_type: string;
    name: string;
    description: string;
    contact_info: string;
    latitude: number;
    longitude: number;
    available_24_7: boolean;
    languages_spoken: string[];
  }> = [];

  for (const region of regions) {
    for (let i = 0; i < 3; i += 1) {
      resources.push({
        region_id: region.id,
        resource_type: resourceTypes[i],
        name: `${region.name} ${resourceTypes[i].replace("_", " ")} - Unit ${i + 1}`,
        description: `${resourceTypes[i].replace("_", " ")} services for survivors in ${region.name}`,
        contact_info: `+1-800-${Math.floor(Math.random() * 10000000)
          .toString()
          .padStart(7, "0")}`,
        latitude: region.latitude + (Math.random() - 0.5) * 0.2,
        longitude: region.longitude + (Math.random() - 0.5) * 0.2,
        available_24_7: i === 0 || i === 1,
        languages_spoken: ["English", "Swahili", "French"],
      });
    }
  }

  const { data, error } = await supabase
    .from("resources")
    .insert(resources)
    .select();

  if (error) {
    console.error("Error seeding resources:", error);
  } else {
    console.log(`✅ Created ${data?.length || 0} resources`);
  }

  return data || [];
}

async function seedGovernanceData() {
  console.log("🏛️ Seeding governance models...");

  const models = [
    {
      name: "GBV Risk Prediction Model v2.1",
      version: "2.1.0",
      module: "prediction",
      status: "active",
      accuracy: 0.89,
      fairness_score: 0.92,
      drift_detected: false,
    },
    {
      name: "Survivor Support Chatbot v1.5",
      version: "1.5.0",
      module: "survivor_support",
      status: "active",
      accuracy: 0.85,
      fairness_score: 0.88,
      drift_detected: false,
    },
    {
      name: "Justice Case Prioritization v3.0",
      version: "3.0.0",
      module: "justice",
      status: "active",
      accuracy: 0.91,
      fairness_score: 0.94,
      drift_detected: false,
    },
  ];

  const { data: modelData, error: modelError } = await supabase
    .from("governance_models")
    .insert(models)
    .select();

  if (modelError) {
    console.error("Error seeding governance models:", modelError);
  } else {
    console.log(`✅ Created ${modelData?.length || 0} governance models`);
  }

  // Seed fairness metrics
  if (modelData) {
    const fairnessMetrics: Array<{
      model_id: string;
      demographic_group: string;
      metric_name: string;
      metric_value: number;
      status: string;
    }> = [];
    for (const model of modelData) {
      fairnessMetrics.push({
        model_id: model.id,
        demographic_group: "gender",
        metric_name: "demographic_parity",
        metric_value: 0.92,
        status: "pass",
      });
      fairnessMetrics.push({
        model_id: model.id,
        demographic_group: "region",
        metric_name: "equalized_odds",
        metric_value: 0.88,
        status: "pass",
      });
    }

    const { error: metricsError } = await supabase
      .from("fairness_metrics")
      .insert(fairnessMetrics);

    if (metricsError) {
      console.error("Error seeding fairness metrics:", metricsError);
    } else {
      console.log(
        `✅ Created ${fairnessMetrics.length} fairness metrics`
      );
    }
  }
}

async function seedSystemMetrics() {
  console.log("📊 Seeding system metrics...");

  const metrics = {
    total_incidents: 1247,
    active_alerts: 34,
    survivors_supported: 892,
    models_deployed: 6,
    regions_monitored: 12,
    countries_active: 6,
    avg_response_time_seconds: 45.2,
    system_uptime_percent: 99.7,
    cases_processed: 567,
    conviction_rate: 62.5,
    avg_case_duration_days: 156,
    shelter_occupancy_percent: 78.3,
    agents_online: 127,
    api_requests_today: 45670,
    data_points_processed: "2.3M",
    encryption_status: "active",
    recorded_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("system_metrics")
    .insert(metrics)
    .select();

  if (error) {
    console.error("Error seeding system metrics:", error);
  } else {
    console.log("✅ Created system metrics snapshot");
  }
}

async function clearTables() {
  console.log("🗑️ Clearing existing data...");

  const tables = [
    "audit_logs",
    "fairness_metrics",
    "bias_reports",
    "governance_models",
    "ethical_constraints",
    "resources",
    "system_metrics",
    "simulation_results",
    "policy_scenarios",
    "convictions",
    "case_events",
    "justice_cases",
    "safety_plans",
    "chat_messages",
    "survivor_chat_sessions",
    "survivors",
    "anomaly_alerts",
    "incident_timeseries",
    "risk_predictions",
    "incidents",
    "regions",
    "organizations",
  ];

  try {
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).delete().gt("id", "00000000-0000-0000-0000-000000000000");
        if (error && !error.message.includes("no rows")) {
          console.warn(`  ⚠️ ${table}: ${error.message}`);
        }
      } catch (_tableError) {
        // Table might not exist yet, which is fine
      }
    }
    console.log("✅ Cleared all tables");
  } catch (error) {
    console.error("Warning: Error clearing tables (may not exist yet):", error);
  }
}

async function seedDatabase(options: SeedOptions = {}) {
  try {
    console.log("🌱 Starting AEGIS database seed...\n");
    console.log(`📍 Supabase URL: ${supabaseUrl}\n`);

    if (options.clear) {
      console.log("⚠️  --clear flag detected, will clear existing data first\n");
      await clearTables();
      console.log("");
    }

    console.log("Step 1/9: Admin User...");
    await ensureAdminUser();

    console.log("Step 2/9: Organizations...");
    await seedOrganizations();
    
    console.log("Step 3/9: Regions...");
    const regions = await seedRegions();
    
    console.log("Step 4/9: Incidents...");
    await seedIncidents(regions);
    
    console.log("Step 5/9: Resources...");
    await seedResources(regions);
    
    console.log("Step 6/9: Policies...");
    await seedPolicies();
    
    console.log("Step 7/9: Justice Cases...");
    await seedJusticeCases(regions);
    
    console.log("Step 8/9: Governance Models...");
    await seedGovernanceData();
    
    console.log("Step 9/9: System Metrics...");
    await seedSystemMetrics();

    console.log("\n✨ Database seeding complete!");
    console.log("✅ All data loaded successfully\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fatal error during seeding:");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (error.message.includes("401") || error.message.includes("403")) {
        console.error("\n   💡 Hint: Check your SUPABASE_SERVICE_ROLE_KEY");
      }
      if (error.message.includes("404")) {
        console.error("\n   💡 Hint: Check your VITE_SUPABASE_URL");
      }
    }
    console.error(error);
    process.exit(1);
  }
}

// Run with --clear flag to clear existing data first
const shouldClear = process.argv.includes("--clear");

console.log("");
if (shouldClear) {
  console.log("📌 Running with --clear flag (will delete existing data)");
} else {
  console.log("📌 Running seed script (use --clear flag to delete existing data first)");
}
console.log("");

seedDatabase({ clear: shouldClear });
