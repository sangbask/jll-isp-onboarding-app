# Client Sandbox Deployment Handover

This project is deployed as a single Elastic Beanstalk application that serves:

- the React frontend UI
- the Node/Express backend API

The app reads source Excel files from S3 and persists parsed data plus run history in RDS PostgreSQL.

## Architecture

- Frontend: React + Vite
- Backend: Node.js + Express
- App hosting: Elastic Beanstalk
- Raw source files: S3
- Persisted app data: RDS PostgreSQL

## Required AWS resources

Create or prepare these resources in the target AWS sandbox account:

- 1 S3 bucket for raw workbook files
- 1 RDS PostgreSQL instance
- 1 Elastic Beanstalk Node.js environment

Recommended:

- keep Elastic Beanstalk and RDS in the same VPC
- allow the Elastic Beanstalk EC2 security group to access the RDS security group on PostgreSQL port 5432

## Required S3 objects

Upload these workbook files to S3:

- `raw/ad/GlobalADExport_Parsed.xlsx`
- `raw/software/User_roles_C_records_Enrichednobase.xlsx`
- `raw/taxonomy/Consolidated_Groups_Combined.xlsx`

## Required backend environment variables

Set these in the Elastic Beanstalk environment:

- `DATABASE_URL`
- `DATABASE_SSL=require`
- `AWS_REGION`
- `S3_BUCKET`
- `S3_AD_KEY`
- `S3_SOFTWARE_KEY`
- `S3_TAXONOMY_KEY`

Optional:

- `CORS_ORIGIN`
- `SOURCE_DATA_DIR`

### Example values

```env
DATABASE_URL=postgres://postgres:<PASSWORD>@<RDS-ENDPOINT>:5432/postgres
DATABASE_SSL=require
AWS_REGION=us-east-2
S3_BUCKET=jll-isp-onboarding-s3raw
S3_AD_KEY=raw/ad/GlobalADExport_Parsed.xlsx
S3_SOFTWARE_KEY=raw/software/User_roles_C_records_Enrichednobase.xlsx
S3_TAXONOMY_KEY=raw/taxonomy/Consolidated_Groups_Combined.xlsx
```

Notes:

- `DATABASE_URL` can point to a different database name if the target sandbox uses one
- when deploying the combined UI+API Beanstalk app, `CORS_ORIGIN` is usually not needed
- `SOURCE_DATA_DIR` is only for local workbook fallback and is not needed for S3-backed sandbox deployment

## Required RDS settings

Use PostgreSQL.

Recommended minimum setup:

- RDS engine: PostgreSQL
- database name: `postgres` or a dedicated app database
- public accessibility: optional; not required if Elastic Beanstalk is in the same VPC
- security group inbound:
  - `PostgreSQL / 5432 / <Elastic Beanstalk EC2 security group>`
  - optional: `PostgreSQL / 5432 / <your laptop IP>` for local admin access

Important:

- if Elastic Beanstalk can load `/api/health` but DB-backed routes time out, the first thing to check is the RDS security group source rule

## Required Elastic Beanstalk settings

Use:

- platform: Node.js
- environment type: single instance is acceptable for sandbox/demo use

Make sure the Elastic Beanstalk EC2 instance security group is the one allowed in the RDS inbound PostgreSQL rule.

## GitHub deploy source

Repository:

- `git@github.com:sangbask/jll-isp-onboarding-app.git`

Branch:

- `main`

## Exact deploy steps for another AWS environment

### 1. Clone the repo

```bash
git clone git@github.com:sangbask/jll-isp-onboarding-app.git
cd jll-isp-onboarding-app
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Build frontend

```bash
npm run build --workspace frontend
```

### 4. Build backend

```bash
npm run build --workspace backend
```

### 5. Copy frontend build into backend deploy directory

```bash
rm -rf backend/frontend-dist
cp -R frontend/dist backend/frontend-dist
```

### 6. Build Elastic Beanstalk deployment zip

```bash
cd backend
rm -f backend-deploy-full.zip
zip -r backend-deploy-full.zip dist frontend-dist package.json Procfile
```

### 7. Create or update Elastic Beanstalk environment

In AWS Console:

- create a Node.js Elastic Beanstalk application/environment
- set the backend environment variables listed above
- upload `backend/backend-deploy-full.zip`

### 8. Verify backend and app

After deploy, verify:

- `/api/health`
- `/api/storage/status`
- `/api/bundle/options`
- root `/`

Expected:

- `/api/health` returns JSON
- `/api/storage/status` returns Postgres-backed counts
- `/api/bundle/options` returns real dropdown values
- `/` loads the React UI

### 9. Seed or refresh DB from S3

After the first deploy, run:

```bash
curl -X POST http://<ELASTIC-BEANSTALK-URL>/api/storage/sync
```

Then confirm:

```bash
curl http://<ELASTIC-BEANSTALK-URL>/api/storage/status
```

Expected:

- `mode: "postgres"`
- row counts for AD users, software usage, taxonomy, personas, and bundle runs

## Current deployment behavior

The current recommended sandbox deployment is:

- single Elastic Beanstalk app serving both UI and API from one origin

This avoids:

- Amplify/Beanstalk mixed-content issues
- frontend-to-backend CORS problems

## Troubleshooting

### Root URL shows backend JSON instead of the UI

Cause:

- frontend bundle was not included in the uploaded Beanstalk zip

Fix:

- rebuild frontend
- copy `frontend/dist` to `backend/frontend-dist`
- recreate and upload the full deploy zip

### `/api/health` works but `/api/storage/status` times out or fails

Cause:

- Elastic Beanstalk cannot connect to RDS

Check:

- same VPC
- RDS inbound security group rule points to the actual Elastic Beanstalk EC2 security group
- `DATABASE_URL` is correct
- `DATABASE_SSL=require`

### Bundle Workbench loads but dropdowns do not show real values

Cause:

- `/api/bundle/options` is failing

Check:

- `/api/storage/status`
- `/api/bundle/options`
- RDS connectivity
- S3 sync status

### Overview loads but looks like sample data

Cause:

- frontend fallback data may still render if some API calls fail

Check direct endpoints:

- `/api/dashboard/summary`
- `/api/dashboard/bundle-runs`
- `/api/personas`

## Suggested next improvements

For a more production-ready rollout:

- add HTTPS with ACM + load balancer
- add custom domain
- add auth/login protection
- move deployment packaging into CI/CD
