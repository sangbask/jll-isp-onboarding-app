import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import * as XLSX from "xlsx";
import type { AdUser, SoftwareUsage, TaxonomyEntry, WorkbookData } from "../types";

const DEFAULT_AWS_REGION = "us-east-2";
const DEFAULT_S3_BUCKET = "jll-isp-onboarding-s3raw";
const DEFAULT_AD_KEY = "raw/ad/GlobalADExport_Parsed.xlsx";
const DEFAULT_SOFTWARE_KEY = "raw/software/User_roles_C_records_Enrichednobase.xlsx";
const DEFAULT_TAXONOMY_KEY = "raw/taxonomy/Consolidated_Groups_Combined.xlsx";

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/ /g, "").replace(/-/g, "");
}

function normalizeRecord(record: Record<string, unknown>) {
  return Object.entries(record).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[normalizeKey(String(key))] = String(value ?? "").trim();
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

function getS3Config() {
  return {
    region: process.env.AWS_REGION ?? DEFAULT_AWS_REGION,
    bucket: process.env.S3_BUCKET ?? DEFAULT_S3_BUCKET,
    adKey: process.env.S3_AD_KEY ?? DEFAULT_AD_KEY,
    softwareKey: process.env.S3_SOFTWARE_KEY ?? DEFAULT_SOFTWARE_KEY,
    taxonomyKey: process.env.S3_TAXONOMY_KEY ?? DEFAULT_TAXONOMY_KEY,
  };
}

let client: S3Client | null = null;

function getS3Client() {
  if (!client) {
    client = new S3Client({ region: getS3Config().region });
  }

  return client;
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function readObjectBuffer(key: string) {
  const { bucket } = getS3Config();
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`S3 object has no body: s3://${bucket}/${key}`);
  }

  return streamToBuffer(response.Body as NodeJS.ReadableStream);
}

async function readRowsFromS3(key: string, sheetName?: string) {
  const workbook = XLSX.read(await readObjectBuffer(key), { type: "buffer" });
  const targetSheet = sheetName ?? workbook.SheetNames[0];
  const worksheet = workbook.Sheets[targetSheet];

  if (!worksheet) {
    throw new Error(`Sheet "${targetSheet}" not found in s3 object ${key}`);
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });

  return rows.map(normalizeRecord);
}

export function isS3WorkbookSourceConfigured() {
  return Boolean(process.env.S3_BUCKET || DEFAULT_S3_BUCKET);
}

export function getS3WorkbookSourceConfig() {
  return getS3Config();
}

export async function loadWorkbookDataFromS3(): Promise<WorkbookData> {
  const { adKey, softwareKey, taxonomyKey } = getS3Config();
  const [adRows, softwareRows, taxonomyRows] = await Promise.all([
    readRowsFromS3(adKey),
    readRowsFromS3(softwareKey),
    readRowsFromS3(taxonomyKey, "All Job Titles"),
  ]);

  const adUsers: AdUser[] = adRows
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

  const softwareUsage: SoftwareUsage[] = softwareRows
    .map((row) => ({
      email: getValue(row, ["pseudomail", "pseudo_mail", "email", "useremail", "userid", "user"]),
      software: getValue(row, ["relevantsoftware", "relevant_software", "software", "application", "applicationname", "app"]),
    }))
    .filter((row) => row.email && row.software);

  const taxonomyEntries: TaxonomyEntry[] = taxonomyRows
    .map((row) => ({
      businessTitle: getValue(row, ["businesstitle", "title", "jobtitle"]),
      subgroup: getValue(row, ["subgroup"]),
      subSubGroup: getValue(row, ["subsubgroup"]),
      consolidatedGroup: getValue(row, ["consolidatedgroup"]),
      tier: getValue(row, ["tier"]),
    }))
    .filter((row) => row.businessTitle);

  return {
    adUsers,
    softwareUsage,
    taxonomyEntries,
  };
}
