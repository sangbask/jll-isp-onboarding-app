export function getStorageStrategy() {
  return {
    recommendation: "Use S3 for raw source files and Postgres as the system of record.",
    why: [
      "S3 is ideal for uploaded Excel files, versioned raw snapshots, and large artifacts.",
      "Postgres is ideal for joins, filtering, auditability, APIs, and role-based enterprise workflows.",
      "A combined approach lets you reprocess source files without losing lineage."
    ],
    targetFlow: [
      "Upload raw workbook to S3.",
      "Register file version and metadata in Postgres.",
      "Run ingestion job to normalize workbook rows into relational tables.",
      "Serve React and API queries from Postgres-backed tables.",
      "Keep S3 objects for replay, audit, and reprocessing."
    ]
  };
}

