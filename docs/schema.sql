CREATE TABLE file_uploads (
  id UUID PRIMARY KEY,
  source_name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by TEXT,
  status TEXT NOT NULL,
  checksum TEXT,
  row_count INTEGER
);

CREATE TABLE ingestion_runs (
  id UUID PRIMARY KEY,
  file_upload_id UUID REFERENCES file_uploads(id),
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE ad_users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  title TEXT,
  role_name TEXT,
  function_name TEXT,
  department TEXT,
  business_category TEXT,
  region TEXT,
  territory TEXT,
  account_name TEXT,
  source_upload_id UUID REFERENCES file_uploads(id)
);

CREATE TABLE title_taxonomy (
  id UUID PRIMARY KEY,
  business_title TEXT NOT NULL,
  subgroup TEXT,
  sub_sub_group TEXT,
  consolidated_group TEXT,
  tier TEXT,
  source_upload_id UUID REFERENCES file_uploads(id)
);

CREATE TABLE personas (
  id UUID PRIMARY KEY,
  persona_name TEXT NOT NULL,
  standard_title TEXT,
  family_name TEXT,
  confidence_level TEXT,
  validation_status TEXT,
  taxonomy_id UUID REFERENCES title_taxonomy(id)
);

CREATE TABLE software_catalog (
  id UUID PRIMARY KEY,
  software_name TEXT NOT NULL,
  publisher TEXT,
  version TEXT,
  category TEXT,
  deployment_type TEXT,
  confidence_score NUMERIC(5,2),
  status TEXT
);

CREATE TABLE software_usage (
  id UUID PRIMARY KEY,
  ad_user_id UUID REFERENCES ad_users(id),
  software_catalog_id UUID REFERENCES software_catalog(id),
  source_upload_id UUID REFERENCES file_uploads(id)
);

CREATE TABLE bundle_runs (
  id UUID PRIMARY KEY,
  requested_title TEXT NOT NULL,
  requested_function TEXT,
  requested_business_category TEXT,
  requested_region TEXT,
  requested_account TEXT,
  match_level TEXT,
  explanation TEXT,
  persona_name TEXT,
  matched_users INTEGER,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_by TEXT
);

CREATE TABLE bundle_run_items (
  id UUID PRIMARY KEY,
  bundle_run_id UUID REFERENCES bundle_runs(id),
  software_name TEXT NOT NULL,
  frequency_pct NUMERIC(5,2) NOT NULL,
  recommendation_type TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action_name TEXT NOT NULL,
  actor TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
