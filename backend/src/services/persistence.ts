import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type {
  AdUser,
  BundleRunSummary,
  DashboardSummary,
  PersonaRecord,
  PersonaSummary,
  RecommendationOptions,
  RecommendationRequest,
  RecommendationResult,
  SoftwareUsage,
  TaxonomyEntry,
  WorkbookData,
} from "../types";
import { getPool, isDatabaseEnabled } from "./db";
import { buildDashboardSummary, buildRecommendationOptions, loadWorkbookData } from "./excelLoader";
import { buildPersonaSummary } from "./personas";
import {
  getS3WorkbookSourceConfig,
  isS3WorkbookSourceConfigured,
  loadWorkbookDataFromS3,
} from "./s3WorkbookLoader";

const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS file_uploads (
    id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL UNIQUE,
    storage_key TEXT NOT NULL,
    storage_type TEXT NOT NULL DEFAULT 'local',
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    row_count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS ingestion_runs (
    id TEXT PRIMARY KEY,
    run_type TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    details JSONB NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS ad_users (
    email TEXT PRIMARY KEY,
    title TEXT,
    role_name TEXT,
    function_name TEXT,
    business_category TEXT,
    region TEXT,
    account_name TEXT,
    department TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS software_usage (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    software_name TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS title_taxonomy (
    id BIGSERIAL PRIMARY KEY,
    business_title TEXT NOT NULL,
    subgroup TEXT,
    sub_sub_group TEXT,
    consolidated_group TEXT,
    tier TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS personas (
    persona_id TEXT PRIMARY KEY,
    department TEXT,
    title TEXT,
    standard_title TEXT NOT NULL,
    role_name TEXT,
    subgroup TEXT,
    family_name TEXT,
    user_count INTEGER NOT NULL DEFAULT 0,
    confidence_level TEXT NOT NULL,
    bundle_status TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    bundle JSONB NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS bundle_runs (
    id TEXT PRIMARY KEY,
    requested_title TEXT NOT NULL,
    requested_function TEXT,
    requested_business_category TEXT,
    requested_region TEXT,
    requested_account TEXT,
    match_level TEXT,
    explanation TEXT,
    persona_name TEXT,
    matched_users INTEGER NOT NULL DEFAULT 0,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result JSONB NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE TABLE IF NOT EXISTS bundle_run_items (
    id BIGSERIAL PRIMARY KEY,
    bundle_run_id TEXT NOT NULL,
    software_name TEXT NOT NULL,
    frequency_pct NUMERIC(5,2) NOT NULL,
    recommendation_type TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action_name TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

let initializedPromise: Promise<void> | null = null;

async function loadIngestionSourceData() {
  if (!isS3WorkbookSourceConfigured()) {
    return {
      source: "local-workbooks",
      storageType: "local",
      workbookData: loadWorkbookData(true),
      sourceFiles: [
        { sourceName: "GlobalADExport_Parsed.xlsx", storageKey: "local/GlobalADExport_Parsed.xlsx" },
        { sourceName: "User_roles_C_records_Enrichednobase.xlsx", storageKey: "local/User_roles_C_records_Enrichednobase.xlsx" },
        { sourceName: "Consolidated_Groups_Combined.xlsx", storageKey: "local/Consolidated_Groups_Combined.xlsx" },
      ],
    };
  }

  try {
    const s3Config = getS3WorkbookSourceConfig();
    return {
      source: "s3",
      storageType: "s3",
      workbookData: await loadWorkbookDataFromS3(),
      sourceFiles: [
        { sourceName: "GlobalADExport_Parsed.xlsx", storageKey: s3Config.adKey },
        { sourceName: "User_roles_C_records_Enrichednobase.xlsx", storageKey: s3Config.softwareKey },
        { sourceName: "Consolidated_Groups_Combined.xlsx", storageKey: s3Config.taxonomyKey },
      ],
    };
  } catch (error) {
    console.warn("S3 workbook load failed, falling back to local files:", error);
    return {
      source: "local-workbooks",
      storageType: "local",
      workbookData: loadWorkbookData(true),
      sourceFiles: [
        { sourceName: "GlobalADExport_Parsed.xlsx", storageKey: "local/GlobalADExport_Parsed.xlsx" },
        { sourceName: "User_roles_C_records_Enrichednobase.xlsx", storageKey: "local/User_roles_C_records_Enrichednobase.xlsx" },
        { sourceName: "Consolidated_Groups_Combined.xlsx", storageKey: "local/Consolidated_Groups_Combined.xlsx" },
      ],
    };
  }
}

function chunkArray<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function ensureSchema() {
  if (!isDatabaseEnabled()) {
    return;
  }

  const pool = getPool();
  for (const statement of CREATE_STATEMENTS) {
    await pool.query(statement);
  }
}

async function tableRowCount(tableName: string) {
  const result = await getPool().query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${tableName}`);
  return Number(result.rows[0]?.count ?? "0");
}

async function insertBatches<T>(
  client: PoolClient,
  tableName: string,
  columns: string[],
  rows: T[],
  mapRow: (row: T) => unknown[],
  batchSize = 500
) {
  for (const batch of chunkArray(rows, batchSize)) {
    const values: unknown[] = [];
    const placeholders = batch.map((row, rowIndex) => {
      const rowValues = mapRow(row);
      values.push(...rowValues);
      const offset = rowIndex * columns.length;
      return `(${columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(", ")})`;
    });

    await client.query(
      `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES ${placeholders.join(", ")}`,
      values
    );
  }
}

async function initializePersistence() {
  if (!isDatabaseEnabled()) {
    return;
  }

  if (!initializedPromise) {
    initializedPromise = (async () => {
      await ensureSchema();
      const count = await tableRowCount("ad_users");
      if (count === 0) {
        await syncWorkbookToDatabase();
      }
    })();
  }

  await initializedPromise;
}

async function loadWorkbookDataFromDatabase(): Promise<WorkbookData> {
  const [adUsersResult, softwareUsageResult, taxonomyResult] = await Promise.all([
    getPool().query<{
      email: string;
      title: string;
      role_name: string;
      function_name: string;
      business_category: string;
      region: string;
      account_name: string;
      department: string;
    }>("SELECT email, title, role_name, function_name, business_category, region, account_name, department FROM ad_users ORDER BY email"),
    getPool().query<{ email: string; software_name: string }>("SELECT email, software_name FROM software_usage ORDER BY id"),
    getPool().query<{
      business_title: string;
      subgroup: string;
      sub_sub_group: string;
      consolidated_group: string;
      tier: string;
    }>("SELECT business_title, subgroup, sub_sub_group, consolidated_group, tier FROM title_taxonomy ORDER BY business_title"),
  ]);

  return {
    adUsers: adUsersResult.rows.map((row: {
      email: string;
      title: string;
      role_name: string;
      function_name: string;
      business_category: string;
      region: string;
      account_name: string;
      department: string;
    }) => ({
      email: row.email,
      title: row.title,
      role: row.role_name,
      function: row.function_name,
      businessCategory: row.business_category,
      region: row.region,
      account: row.account_name,
      department: row.department,
    })),
    softwareUsage: softwareUsageResult.rows.map((row: { email: string; software_name: string }) => ({
      email: row.email,
      software: row.software_name,
    })),
    taxonomyEntries: taxonomyResult.rows.map((row: {
      business_title: string;
      subgroup: string;
      sub_sub_group: string;
      consolidated_group: string;
      tier: string;
    }) => ({
      businessTitle: row.business_title,
      subgroup: row.subgroup,
      subSubGroup: row.sub_sub_group,
      consolidatedGroup: row.consolidated_group,
      tier: row.tier,
    })),
  };
}

async function loadPersonasFromDatabase(): Promise<PersonaSummary | null> {
  const result = await getPool().query<{
    persona_id: string;
    department: string;
    title: string;
    standard_title: string;
    role_name: string;
    subgroup: string;
    family_name: string;
    user_count: number;
    confidence_level: "High" | "Medium" | "Low";
    bundle_status: "Validated" | "Unvalidated";
    modified_at: string;
    bundle: { base?: string[]; standard?: string[]; recommended?: string[]; optional?: string[] };
  }>(
    `SELECT persona_id, department, title, standard_title, role_name, subgroup, family_name,
            user_count, confidence_level, bundle_status, modified_at, bundle
       FROM personas
      ORDER BY user_count DESC, standard_title ASC`
  );

  if (result.rows.length === 0) {
    return null;
  }

  const personas: PersonaRecord[] = result.rows.map((row: {
    persona_id: string;
    department: string;
    title: string;
    standard_title: string;
    role_name: string;
    subgroup: string;
    family_name: string;
    user_count: number;
    confidence_level: "High" | "Medium" | "Low";
    bundle_status: "Validated" | "Unvalidated";
    modified_at: string;
    bundle: { base?: string[]; standard?: string[]; recommended?: string[]; optional?: string[] };
  }) => ({
    id: row.persona_id,
    department: row.department,
    title: row.title,
    standardTitle: row.standard_title,
    role: row.role_name,
    subgroup: row.subgroup,
    family: row.family_name,
    users: Number(row.user_count ?? 0),
    confidence: row.confidence_level,
    bundleStatus: row.bundle_status,
    modifiedAt: row.modified_at,
    bundle: {
      base: row.bundle?.base ?? [],
      standard: row.bundle?.standard ?? [],
      recommended: row.bundle?.recommended ?? [],
      optional: row.bundle?.optional ?? [],
    },
  }));

  return {
    totalPersonas: personas.length,
    validated: personas.filter((persona) => persona.bundleStatus === "Validated").length,
    lowConfidence: personas.filter((persona) => persona.confidence === "Low").length,
    personas,
  };
}

export async function loadSourceData(): Promise<WorkbookData> {
  if (!isDatabaseEnabled()) {
    return loadWorkbookData();
  }

  await initializePersistence();
  return loadWorkbookDataFromDatabase();
}

export async function getRecommendationOptionsFromStorage(): Promise<RecommendationOptions> {
  return buildRecommendationOptions(await loadSourceData());
}

export async function getDashboardSummaryFromStorage(): Promise<DashboardSummary> {
  return buildDashboardSummary(await loadSourceData());
}

export async function getBundleRunSummaryFromStorage(): Promise<BundleRunSummary> {
  if (!isDatabaseEnabled()) {
    return {
      totalRuns: 0,
      lowConfidenceRuns: 0,
      unmatchedRuns: 0,
      matchLevelBreakdown: [],
      recentRuns: [],
    };
  }

  await initializePersistence();

  const [countsResult, breakdownResult, recentRunsResult] = await Promise.all([
    getPool().query<{
      total_runs: string;
      low_confidence_runs: string;
      unmatched_runs: string;
    }>(`
      SELECT
        COUNT(*)::text AS total_runs,
        COUNT(*) FILTER (WHERE match_level IN ('3d', 'semantic', 'none'))::text AS low_confidence_runs,
        COUNT(*) FILTER (WHERE match_level = 'none')::text AS unmatched_runs
      FROM bundle_runs
    `),
    getPool().query<{ match_level: string; count: string }>(`
      SELECT COALESCE(match_level, 'unknown') AS match_level, COUNT(*)::text AS count
      FROM bundle_runs
      GROUP BY COALESCE(match_level, 'unknown')
      ORDER BY COUNT(*) DESC, COALESCE(match_level, 'unknown') ASC
    `),
    getPool().query<{
      id: string;
      requested_at: string;
      requested_title: string;
      persona_name: string;
      match_level: string;
      matched_users: number;
      requested_region: string;
      requested_account: string;
    }>(`
      SELECT
        id,
        requested_at::text,
        requested_title,
        persona_name,
        COALESCE(match_level, 'unknown') AS match_level,
        matched_users,
        requested_region,
        requested_account
      FROM bundle_runs
      ORDER BY requested_at DESC
      LIMIT 8
    `),
  ]);

  return {
    totalRuns: Number(countsResult.rows[0]?.total_runs ?? "0"),
    lowConfidenceRuns: Number(countsResult.rows[0]?.low_confidence_runs ?? "0"),
    unmatchedRuns: Number(countsResult.rows[0]?.unmatched_runs ?? "0"),
    matchLevelBreakdown: breakdownResult.rows.map((row) => ({
      label: row.match_level,
      count: Number(row.count ?? "0"),
    })),
    recentRuns: recentRunsResult.rows.map((row) => ({
      id: row.id,
      requestedAt: row.requested_at,
      requestedTitle: row.requested_title,
      personaName: row.persona_name,
      matchLevel: row.match_level,
      matchedUsers: Number(row.matched_users ?? 0),
      requestedRegion: row.requested_region,
      requestedAccount: row.requested_account,
    })),
  };
}

export async function getPersonaSummaryFromStorage(): Promise<PersonaSummary> {
  if (!isDatabaseEnabled()) {
    return buildPersonaSummary(loadWorkbookData());
  }

  await initializePersistence();
  const persisted = await loadPersonasFromDatabase();
  return persisted ?? buildPersonaSummary(await loadSourceData());
}

export async function syncWorkbookToDatabase() {
  if (!isDatabaseEnabled()) {
    return { enabled: false, mode: "workbook-only" };
  }

  await ensureSchema();
  const ingestionSource = await loadIngestionSourceData();
  const workbookData = ingestionSource.workbookData;
  const personaSummary = buildPersonaSummary(workbookData);
  const client = await getPool().connect();
  const runId = randomUUID();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO ingestion_runs (id, run_type, status, details)
       VALUES ($1, $2, $3, $4)`,
      [runId, "full-sync", "running", JSON.stringify({ source: ingestionSource.source })]
    );

    await client.query("TRUNCATE TABLE software_usage, ad_users, title_taxonomy, personas RESTART IDENTITY");
    await client.query("DELETE FROM file_uploads");

    await insertBatches(
      client,
      "file_uploads",
      ["id", "source_name", "storage_key", "storage_type", "row_count"],
      [
        {
          sourceName: ingestionSource.sourceFiles[0].sourceName,
          storageKey: ingestionSource.sourceFiles[0].storageKey,
          rowCount: workbookData.adUsers.length,
        },
        {
          sourceName: ingestionSource.sourceFiles[1].sourceName,
          storageKey: ingestionSource.sourceFiles[1].storageKey,
          rowCount: workbookData.softwareUsage.length,
        },
        {
          sourceName: ingestionSource.sourceFiles[2].sourceName,
          storageKey: ingestionSource.sourceFiles[2].storageKey,
          rowCount: workbookData.taxonomyEntries.length,
        },
      ],
      (row) => [randomUUID(), row.sourceName, row.storageKey, ingestionSource.storageType, row.rowCount]
    );

    await insertBatches(
      client,
      "ad_users",
      ["email", "title", "role_name", "function_name", "business_category", "region", "account_name", "department"],
      workbookData.adUsers,
      (row: AdUser) => [row.email, row.title, row.role, row.function, row.businessCategory, row.region, row.account, row.department]
    );

    await insertBatches(
      client,
      "software_usage",
      ["email", "software_name"],
      workbookData.softwareUsage,
      (row: SoftwareUsage) => [row.email, row.software]
    );

    await insertBatches(
      client,
      "title_taxonomy",
      ["business_title", "subgroup", "sub_sub_group", "consolidated_group", "tier"],
      workbookData.taxonomyEntries,
      (row: TaxonomyEntry) => [row.businessTitle, row.subgroup, row.subSubGroup, row.consolidatedGroup, row.tier]
    );

    await insertBatches(
      client,
      "personas",
      ["persona_id", "department", "title", "standard_title", "role_name", "subgroup", "family_name", "user_count", "confidence_level", "bundle_status", "modified_at", "bundle"],
      personaSummary.personas,
      (row: PersonaRecord) => [
        row.id,
        row.department,
        row.title,
        row.standardTitle,
        row.role,
        row.subgroup,
        row.family,
        row.users,
        row.confidence,
        row.bundleStatus,
        row.modifiedAt,
        JSON.stringify(row.bundle),
      ],
      200
    );

    await client.query(
      `UPDATE ingestion_runs
          SET status = $2, completed_at = NOW(), details = $3
        WHERE id = $1`,
      [runId, "completed", JSON.stringify({
        source: ingestionSource.source,
        adUsers: workbookData.adUsers.length,
        softwareUsage: workbookData.softwareUsage.length,
        taxonomyEntries: workbookData.taxonomyEntries.length,
        personas: personaSummary.totalPersonas,
      })]
    );

    await client.query("COMMIT");

    return {
      enabled: true,
      mode: "postgres",
      runId,
      source: ingestionSource.source,
      counts: {
        adUsers: workbookData.adUsers.length,
        softwareUsage: workbookData.softwareUsage.length,
        taxonomyEntries: workbookData.taxonomyEntries.length,
        personas: personaSummary.totalPersonas,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveBundleRun(input: RecommendationRequest, result: RecommendationResult) {
  if (!isDatabaseEnabled()) {
    return;
  }

  await initializePersistence();
  const client = await getPool().connect();
  const runId = randomUUID();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO bundle_runs (
        id, requested_title, requested_function, requested_business_category,
        requested_region, requested_account, match_level, explanation,
        persona_name, matched_users, result
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        runId,
        input.title,
        input.function,
        input.businessCategory,
        input.region,
        input.account,
        result.matchLevel,
        result.explanation,
        result.persona,
        result.matchedUsers,
        JSON.stringify(result),
      ]
    );

    if (result.software.length > 0) {
      await insertBatches(
        client,
        "bundle_run_items",
        ["bundle_run_id", "software_name", "frequency_pct", "recommendation_type"],
        result.software,
        (item) => [runId, item.name, item.frequency, item.recommendation]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPersistenceStatus() {
  if (!isDatabaseEnabled()) {
    return { enabled: false, mode: "workbook-only" };
  }

  await initializePersistence();

  const [adUsers, softwareUsage, titleTaxonomy, personas, bundleRuns] = await Promise.all([
    tableRowCount("ad_users"),
    tableRowCount("software_usage"),
    tableRowCount("title_taxonomy"),
    tableRowCount("personas"),
    tableRowCount("bundle_runs"),
  ]);

  return {
    enabled: true,
    mode: "postgres",
    ingestionSource: isS3WorkbookSourceConfigured() ? "s3-preferred" : "local-only",
    s3Config: getS3WorkbookSourceConfig(),
    counts: {
      adUsers,
      softwareUsage,
      titleTaxonomy,
      personas,
      bundleRuns,
    },
  };
}
