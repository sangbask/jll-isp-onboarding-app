# JLL Intelligent Software Provisioning Platform

This workspace is a production-oriented starter for rebuilding the current Streamlit prototype from `/Users/sangeetha/persona_engine/app.py` into a React + Node.js application that matches the supplied HTML prototype.

## Structure

- `frontend/`: React + TypeScript app that mirrors the provided prototype screens
- `backend/`: Node.js + TypeScript API with recommendation-engine and ingestion boundaries
- `docs/architecture.md`: migration notes for S3 + Postgres + ingestion
- `docs/schema.sql`: starter relational schema for enterprise deployment

## What Is Included

- Prototype-inspired dashboard, persona, provisioning, reporting, and settings screens
- A `Bundle Workbench` page that reflects the form and recommendation flow from the current Streamlit app
- Backend API routes for health, recommendation requests, and storage guidance
- A TypeScript recommendation service that mirrors the current rule-engine shape from `app.py`

## What Still Needs Wiring

- Real Excel parsing and ingestion from the source files in `/Users/sangeetha/persona_engine/data`
- Authentication and authorization
- Database persistence and audit logging
- ServiceNow, S3, and optional vector-search integrations

## Suggested Next Build Order

1. Install frontend and backend dependencies.
2. Wire the backend ingestion service to the uploaded Excel files.
3. Replace mock fixtures with Postgres-backed repositories.
4. Add auth and role-based access.
5. Connect provisioning actions to ServiceNow or your ticketing workflow.

