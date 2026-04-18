# Architecture Direction

## Current State

The Streamlit prototype at `/Users/sangeetha/persona_engine/app.py` does all of the following in one file:

- reads Excel files directly from the local `data/` folder
- normalizes workbook columns
- matches job titles to Active Directory cohorts
- derives personas from taxonomy data
- computes recommended versus optional software bundles
- optionally calls RAG/LLM services

That is good for prototyping, but not for enterprise delivery.

## Recommended Target Architecture

### Frontend

- React + TypeScript
- page-driven app that matches the supplied HTML prototype
- authenticated admin and end-user experiences

### Backend

- Node.js + TypeScript API
- modules:
  - `recommendation`
  - `persona-management`
  - `software-catalog`
  - `ingestion`
  - `audit`
  - `provisioning`

### Data Platform

- `S3` for raw uploaded workbooks and historical snapshots
- `Postgres` for normalized application data
- optional vector search only for future semantic retrieval, not core provisioning logic

## Workbook Mapping

### `GlobalADExport_Parsed.xlsx`

Use for:

- title
- role
- function
- department
- business category
- region
- territory
- account
- pseudo mail

Target table: `ad_users`

### `User_roles_C_records_Enrichednobase.xlsx`

Use for:

- pseudo mail
- title
- region
- function
- account
- relevant software
- persona columns

Target tables:

- `software_usage`
- `persona_assignments`

### `Consolidated_Groups_Combined.xlsx`

Use for:

- business title
- subgroup
- sub-sub-group
- consolidated group
- tier

Target tables:

- `title_taxonomy`
- `personas`

## Recommended Ingestion Flow

1. Upload workbook to S3.
2. Create a `file_uploads` record in Postgres.
3. Parse workbook in a background ingestion job.
4. Normalize and validate rows.
5. Upsert business tables.
6. Write data-quality issues and lineage metadata.
7. Mark ingestion run complete and expose it in the admin UI.

## Recommended Product Phases

1. Port current rule engine from Python to Node.js.
2. Build the prototype UI in React.
3. Add real ingestion from Excel to Postgres.
4. Add auth, audit trails, and role-based screens.
5. Integrate ServiceNow or downstream provisioning system.
6. Add observability, retry handling, and scheduled delta ingestion.

