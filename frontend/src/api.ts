import type {
  BundleRunSummary,
  DashboardSummary,
  PersonaSummary,
  RecommendationOptions,
  RecommendationRequest,
  RecommendationResult,
} from "./types";

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const isLocalBrowser =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const API_BASES = configuredApiBase
  ? [configuredApiBase]
  : isLocalBrowser
    ? ["http://127.0.0.1:3001", "http://localhost:3001", ""]
    : [""];

async function fetchWithTimeout(input: string, init?: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  let lastError: unknown;

  for (const base of API_BASES) {
    try {
      const response = await fetchWithTimeout(`${base}${path}`, init, timeoutMs);

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      console.error(`API request failed for ${base || "proxy"}${path}`, error);
    }
  }

  throw lastError;
}

const fallbackResult: RecommendationResult = {
  matchLevel: "3a",
  explanation: "Exact title match from seeded prototype data",
  persona: "Facilities Manager",
  matchedUsers: 47,
  matchedUserRows: [
    {
      email: "fm01@company.test",
      title: "Facilities Manager",
      region: "APAC",
      businessCategory: "Work Dynamics",
    },
    {
      email: "fm02@company.test",
      title: "Facilities Manager",
      region: "APAC",
      businessCategory: "Work Dynamics",
    },
  ],
  software: [
    { name: "Microsoft Office 365", frequency: 100, recommendation: "Recommended" },
    { name: "Slack", frequency: 79, recommendation: "Recommended" },
    { name: "Zoom Workplace", frequency: 74, recommendation: "Recommended" },
    { name: "Adobe Acrobat Pro DC", frequency: 61, recommendation: "Recommended" },
    { name: "AutoCAD", frequency: 34, recommendation: "Optional" },
  ],
};

const fallbackOptions: RecommendationOptions = {
  titles: ["Facilities Manager", "Senior Project Manager", "Financial Analyst", "Solutions Architect"],
  functions: ["Facilities Management", "Project Management", "Finance", "Technology"],
  businessCategories: ["Work Dynamics", "Project Services", "Corporate"],
  regions: ["APAC", "EMEA", "AMER"],
  accounts: ["Corporate"],
};

const fallbackDashboard: DashboardSummary = {
  stats: {
    totalAdUsers: 31119,
    uniqueTitles: 2833,
    uniqueFunctions: 18,
    uniqueSoftware: 2363,
    taxonomyTitles: 1492,
    softwareAssignments: 143405,
  },
  topDepartments: [
    { label: "Facilities Management", count: 4201 },
    { label: "Project Management", count: 3827 },
    { label: "Finance", count: 2410 },
    { label: "IT", count: 1892 },
  ],
  topRegions: [
    { label: "APAC", count: 12650 },
    { label: "EMEA", count: 10114 },
    { label: "AMER", count: 8355 },
  ],
  topSoftware: [
    { label: "Microsoft Office 365", count: 26780 },
    { label: "Slack", count: 21410 },
    { label: "Zoom Workplace", count: 18944 },
    { label: "Adobe Acrobat Pro DC", count: 15662 },
  ],
  sourceFiles: [
    { name: "GlobalADExport_Parsed.xlsx", rows: 31119 },
    { name: "User_roles_C_records_Enrichednobase.xlsx", rows: 143405 },
    { name: "Consolidated_Groups_Combined.xlsx", rows: 1492 },
  ],
};

const fallbackPersonas: PersonaSummary = {
  totalPersonas: 4,
  validated: 3,
  lowConfidence: 1,
  personas: [
    {
      id: "P001",
      department: "Facilities Management",
      title: "Facilities Manager",
      standardTitle: "Facilities Manager",
      role: "Operations",
      subgroup: "Facility Ops",
      family: "Property & Asset Mgmt",
      users: 47,
      confidence: "High",
      bundleStatus: "Validated",
      modifiedAt: "Live workbook data",
      bundle: {
        base: ["Windows 11 Enterprise", "Microsoft Edge", "Microsoft Defender"],
        standard: ["Microsoft Office 365", "Slack", "Zoom Workplace"],
        recommended: ["Adobe Acrobat Pro DC", "Microsoft Visio"],
        optional: ["AutoCAD"],
      },
    },
  ],
};

const fallbackBundleRuns: BundleRunSummary = {
  totalRuns: 0,
  lowConfidenceRuns: 0,
  unmatchedRuns: 0,
  matchLevelBreakdown: [],
  recentRuns: [],
};

export async function getRecommendation(
  payload: RecommendationRequest
): Promise<RecommendationResult> {
  return await requestJson<RecommendationResult>(
    "/api/bundle/recommend",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    30000
  );
}

export async function getRecommendationOptions(): Promise<RecommendationOptions> {
  return await requestJson<RecommendationOptions>("/api/bundle/options");
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    return await requestJson<DashboardSummary>("/api/dashboard/summary");
  } catch {
    return fallbackDashboard;
  }
}

export async function getBundleRunSummary(): Promise<BundleRunSummary> {
  try {
    return await requestJson<BundleRunSummary>("/api/dashboard/bundle-runs");
  } catch {
    return fallbackBundleRuns;
  }
}

export async function getPersonaSummary(): Promise<PersonaSummary> {
  try {
    return await requestJson<PersonaSummary>("/api/personas");
  } catch {
    return fallbackPersonas;
  }
}
