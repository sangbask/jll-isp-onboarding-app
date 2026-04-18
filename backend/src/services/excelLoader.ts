import path from "node:path";
import * as XLSX from "xlsx";
import type {
  AdUser,
  DashboardCountItem,
  DashboardSummary,
  RecommendationOptions,
  SoftwareUsage,
  TaxonomyEntry,
  WorkbookData,
} from "../types";

const DEFAULT_SOURCE_DIR = "/Users/sangeetha/persona_engine/data";

let cachedWorkbookData: WorkbookData | null = null;

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/ /g, "").replace(/-/g, "");
}

function normalizeRecord(record: Record<string, unknown>) {
  return Object.entries(record).reduce<Record<string, string>>((acc, [key, value]) => {
    const normalized = normalizeKey(String(key));
    acc[normalized] = String(value ?? "").trim();
    return acc;
  }, {});
}

function getValue(record: Record<string, string>, options: string[]) {
  for (const option of options) {
    const value = record[option];
    if (value) {
      return value;
    }
  }
  return "";
}

function readRows(filePath: string, sheetName?: string) {
  const workbook = XLSX.readFile(filePath);
  const targetSheet = sheetName ?? workbook.SheetNames[0];
  const worksheet = workbook.Sheets[targetSheet];

  if (!worksheet) {
    throw new Error(`Sheet "${targetSheet}" not found in ${filePath}`);
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });

  return rows.map(normalizeRecord);
}

function loadAdUsers(sourceDir: string): AdUser[] {
  const filePath = path.join(sourceDir, "GlobalADExport_Parsed.xlsx");
  const rows = readRows(filePath);

  return rows
    .map((row) => ({
      email: getValue(row, ["pseudomail", "pseudo_mail", "email"]),
      title: getValue(row, ["title", "jobtitle", "businesstitle"]),
      role: getValue(row, ["role"]),
      function: getValue(row, ["function"]),
      businessCategory: getValue(row, ["businesscategory", "department"]),
      region: getValue(row, ["region", "jllregion"]),
      account: getValue(row, ["account", "territory"]),
      department: getValue(row, ["department"]),
    }))
    .filter((row) => row.email && row.title);
}

function loadSoftwareUsage(sourceDir: string): SoftwareUsage[] {
  const filePath = path.join(sourceDir, "User_roles_C_records_Enrichednobase.xlsx");
  const rows = readRows(filePath);

  return rows
    .map((row) => ({
      email: getValue(row, ["pseudomail", "pseudo_mail", "email", "useremail", "userid", "user"]),
      software: getValue(row, ["relevantsoftware", "relevant_software", "software", "application", "applicationname", "app"]),
    }))
    .filter((row) => row.email && row.software);
}

function loadTaxonomyEntries(sourceDir: string): TaxonomyEntry[] {
  const filePath = path.join(sourceDir, "Consolidated_Groups_Combined.xlsx");
  const rows = readRows(filePath, "All Job Titles");

  return rows
    .map((row) => ({
      businessTitle: getValue(row, ["businesstitle", "title", "jobtitle"]),
      subgroup: getValue(row, ["subgroup"]),
      subSubGroup: getValue(row, ["subsubgroup"]),
      consolidatedGroup: getValue(row, ["consolidatedgroup"]),
      tier: getValue(row, ["tier"]),
    }))
    .filter((row) => row.businessTitle);
}

export function loadWorkbookData(forceReload = false): WorkbookData {
  if (cachedWorkbookData && !forceReload) {
    return cachedWorkbookData;
  }

  const sourceDir = process.env.SOURCE_DATA_DIR ?? DEFAULT_SOURCE_DIR;

  cachedWorkbookData = {
    adUsers: loadAdUsers(sourceDir),
    softwareUsage: loadSoftwareUsage(sourceDir),
    taxonomyEntries: loadTaxonomyEntries(sourceDir),
  };

  return cachedWorkbookData;
}

export function getWorkbookStats() {
  const data = loadWorkbookData();

  return {
    sourceDir: process.env.SOURCE_DATA_DIR ?? DEFAULT_SOURCE_DIR,
    adUsers: data.adUsers.length,
    softwareUsage: data.softwareUsage.length,
    taxonomyEntries: data.taxonomyEntries.length,
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function buildRecommendationOptions({ adUsers }: WorkbookData): RecommendationOptions {
  return {
    titles: uniqueSorted(adUsers.map((user) => user.title)),
    functions: uniqueSorted(adUsers.map((user) => user.function)),
    businessCategories: uniqueSorted(adUsers.map((user) => user.businessCategory)),
    regions: uniqueSorted(adUsers.map((user) => user.region)),
    accounts: uniqueSorted(adUsers.map((user) => user.account)),
  };
}

export function getRecommendationOptions(): RecommendationOptions {
  return buildRecommendationOptions(loadWorkbookData());
}

function topCounts(values: string[], limit: number): DashboardCountItem[] {
  const counts = new Map<string, number>();

  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function buildDashboardSummary({ adUsers, softwareUsage, taxonomyEntries }: WorkbookData): DashboardSummary {
  return {
    stats: {
      totalAdUsers: adUsers.length,
      uniqueTitles: new Set(adUsers.map((user) => user.title).filter(Boolean)).size,
      uniqueFunctions: new Set(adUsers.map((user) => user.function).filter(Boolean)).size,
      uniqueSoftware: new Set(softwareUsage.map((item) => item.software).filter(Boolean)).size,
      taxonomyTitles: taxonomyEntries.length,
      softwareAssignments: softwareUsage.length,
    },
    topDepartments: topCounts(adUsers.map((user) => user.department || user.businessCategory), 6),
    topRegions: topCounts(adUsers.map((user) => user.region), 6),
    topSoftware: topCounts(softwareUsage.map((item) => item.software), 8),
    sourceFiles: [
      { name: "GlobalADExport_Parsed.xlsx", rows: adUsers.length },
      { name: "User_roles_C_records_Enrichednobase.xlsx", rows: softwareUsage.length },
      { name: "Consolidated_Groups_Combined.xlsx", rows: taxonomyEntries.length },
    ],
  };
}

export function getDashboardSummary(): DashboardSummary {
  return buildDashboardSummary(loadWorkbookData());
}
