# AI_Bharath - AdhikarLoop

Court Judgment Enforcement Action Assurance system for the hackathon theme:
**From Court Judgments to Verified Action Plans**.

## What this project does

This full-stack app converts a judgment (PDF or pasted text) into a structured action pipeline:

1. Upload judgment
2. Extract case details and actionable directives
3. Generate action plan metadata (department, deadlines, risk, priority)
4. Human verification (approve/edit/reject)
5. Publish only trusted (approved/edited) actions to dashboard
6. Track execution status, dependencies, and audit trail

## Stack

- Frontend: React + Vite + Tailwind
- Backend: Node.js + Express
- Database: MongoDB via Mongoose
- Demo fallback DB: `mongodb-memory-server`

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB (optional if using in-memory demo mode)

## Setup

1. Install dependencies:

```bash
npm run install:all
```

2. Create backend environment file:

Linux/macOS:

```bash
cp server/.env.example server/.env
```

Windows (PowerShell):

```powershell
Copy-Item server/.env.example server/.env
```

3. Choose one backend mode:

- Persistent MongoDB mode (recommended):
  - Start local MongoDB
  - Keep `MONGO_URI` in `server/.env` as `mongodb://127.0.0.1:27017/adhikarloop`
- In-memory demo mode (no local Mongo install required):
  - Run backend with `MONGO_URI=memory`

## Run Commands

### Full app (client + server)

```bash
npm run dev
```

### Backend only (in-memory demo mode)

```bash
npm run dev:demo --prefix server
```

### Seed persistent database

```bash
npm run seed
```

### Production client build

```bash
npm run build
```

## Environment Variables (`server/.env`)

- `PORT` - Backend port (default: `5000`)
- `MONGO_URI` - Mongo connection string (or `memory` for demo mode)
- `JWT_SECRET` - JWT signing secret
- `CLIENT_ORIGIN` - Allowed frontend origins (comma separated)
- `MONGO_DNS_SERVERS` - DNS servers used for `mongodb+srv` URIs
- `MONGO_FALLBACK_TO_MEMORY` - `true/false`, fallback to in-memory DB if persistent DB fails
- `AUTO_SEED` - `true/false`, auto-seed on startup (enabled in demo mode)

## Demo Credentials

All demo users use password: `Demo@1234`

- `admin@adhikar.gov.in`
- `reviewer@adhikar.gov.in`
- `viewer@adhikar.gov.in`

## Role Permissions

- `admin`: upload judgments, verify/edit/reject directives, submit verified cases, update tracking status, delete cases.
- `reviewer`: upload judgments, verify/edit/reject directives, submit verified cases, update tracking status.
- `viewer`: read-only access to dashboard, cases, departments, audit trail, and dependency view.

## Demo Flow (Submission Walkthrough)

1. Login as `admin` or `reviewer`.
2. Open **Upload & Extraction** and upload a PDF or paste judgment text.
3. Verify extracted case details:
   - Case title
   - Court name
   - Case number
   - Petitioner/respondent
   - Date of order
4. Review extracted directives with source text, confidence score, and timelines.
5. Open **Human Verification**:
   - Highlight source text
   - Approve / Edit / Reject each directive
   - Edit department, deadline, priority, risk, dependencies
6. Submit verified case:
   - Case moves forward only if at least one directive is approved/edited
   - Pending directives are blocked from submission
7. Open **Dashboard (Trusted View)**:
   - Shows only approved/edited directives
   - Department-wise analytics
   - Important dates and structured action register
8. Open case details to continue tracking:
   - Pending / In Progress / Completed
   - Dependency graph
   - Audit trail (verification, edits, status changes, timestamps)

## Core Feature Coverage

- Case understanding from PDF/text
- Directive extraction with source linkage and confidence
- Action-plan generation (classification, department, deadline, risk, priority)
- Mandatory human verification gate
- Trusted dashboard with approved-only records
- Action tracking, dependency tracking, and audit trail
