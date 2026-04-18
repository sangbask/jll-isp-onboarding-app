export type PageId =
  | "overview"
  | "workbench"
  | "cleansing"
  | "personas"
  | "provisioning"
  | "newjoiner"
  | "reports"
  | "settings";

export interface NavItem {
  id: PageId;
  label: string;
  section: string;
  icon: string;
  badge?: number;
}

export interface SummaryCardData {
  label: string;
  value: string;
  subtext?: string;
  accent: string;
}

export interface SoftwareItem {
  id: string;
  publisher: string;
  name: string;
  version: string;
  category: string;
  deploymentType: string;
  confidence: number;
  status: string;
}

export interface PersonaItem {
  id: string;
  department: string;
  title: string;
  standardTitle: string;
  role: string;
  subgroup: string;
  family: string;
  users: number;
  confidence: "High" | "Medium" | "Low";
  bundleStatus: "Validated" | "Unvalidated";
  modifiedAt: string;
  bundle: {
    base: string[];
    standard: string[];
    recommended: string[];
    optional: string[];
  };
}

export interface ProvisioningLog {
  id: string;
  timestamp: string;
  user: string;
  department: string;
  title: string;
  personaId: string;
  match: "Exact" | "Nearest";
  mode: "Interactive" | "Silent";
  total: number;
  preApproved: number;
  managerApproved: number;
  financeApproved: number;
  status: "Completed" | "Partial" | "Failed";
  software: string[];
}

export interface RunHistory {
  id: string;
  type: "Full" | "Delta";
  date: string;
  records: number;
  status: string;
  duration: string;
  mainPackages: number;
  filtered: number;
}

export interface RecommendationRequest {
  title: string;
  function: string;
  businessCategory: string;
  region: string;
  account: string;
}

export interface RecommendationOptions {
  titles: string[];
  functions: string[];
  businessCategories: string[];
  regions: string[];
  accounts: string[];
}

export interface DashboardCountItem {
  label: string;
  count: number;
}

export interface DashboardSummary {
  stats: {
    totalAdUsers: number;
    uniqueTitles: number;
    uniqueFunctions: number;
    uniqueSoftware: number;
    taxonomyTitles: number;
    softwareAssignments: number;
  };
  topDepartments: DashboardCountItem[];
  topRegions: DashboardCountItem[];
  topSoftware: DashboardCountItem[];
  sourceFiles: Array<{
    name: string;
    rows: number;
  }>;
}

export interface BundleRunSummary {
  totalRuns: number;
  lowConfidenceRuns: number;
  unmatchedRuns: number;
  matchLevelBreakdown: Array<{
    label: string;
    count: number;
  }>;
  recentRuns: Array<{
    id: string;
    requestedAt: string;
    requestedTitle: string;
    personaName: string;
    matchLevel: string;
    matchedUsers: number;
    requestedRegion: string;
    requestedAccount: string;
  }>;
}

export interface PersonaSummary {
  totalPersonas: number;
  validated: number;
  lowConfidence: number;
  personas: PersonaItem[];
}

export interface RecommendationResult {
  matchLevel: string;
  explanation: string;
  persona: string;
  matchedUsers: number;
  matchedUserRows: Array<{
    email: string;
    title: string;
    region: string;
    businessCategory: string;
  }>;
  software: Array<{
    name: string;
    frequency: number;
    recommendation: "Recommended" | "Optional";
  }>;
}
