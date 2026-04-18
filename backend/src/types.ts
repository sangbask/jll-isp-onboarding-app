export interface RecommendationRequest {
  title: string;
  function: string;
  businessCategory: string;
  region: string;
  account: string;
  department?: string;
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

export interface PersonaBundle {
  base: string[];
  standard: string[];
  recommended: string[];
  optional: string[];
}

export interface PersonaRecord {
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
  bundle: PersonaBundle;
}

export interface PersonaSummary {
  totalPersonas: number;
  validated: number;
  lowConfidence: number;
  personas: PersonaRecord[];
}

export interface AdUser {
  email: string;
  title: string;
  role: string;
  function: string;
  businessCategory: string;
  region: string;
  account: string;
  department: string;
}

export interface SoftwareUsage {
  email: string;
  software: string;
}

export interface TaxonomyEntry {
  businessTitle: string;
  subgroup: string;
  subSubGroup: string;
  consolidatedGroup: string;
  tier: string;
}

export interface WorkbookData {
  adUsers: AdUser[];
  softwareUsage: SoftwareUsage[];
  taxonomyEntries: TaxonomyEntry[];
}

export interface RecommendationItem {
  name: string;
  frequency: number;
  recommendation: "Recommended" | "Optional";
}

export interface MatchedUser {
  email: string;
  title: string;
  region: string;
  businessCategory: string;
}

export interface RecommendationResult {
  matchLevel: string;
  explanation: string;
  persona: string;
  matchedUsers: number;
  matchedUserRows: MatchedUser[];
  software: RecommendationItem[];
}
