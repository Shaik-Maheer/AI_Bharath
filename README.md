# AdhikarLoop

Court Judgement Enforcement Action Assurance Closed Loop System.

## Run locally

1. Install dependencies:

```bash
npm run install:all
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

2. Copy server environment:

```bash
copy server\\.env.example server\\.env
```

3. Start MongoDB locally at `127.0.0.1:27017`, then seed demo data:

```bash
npm run seed
```

4. Start the MERN prototype:

```bash
npm run dev
```

Client: `http://localhost:5173`

Server: `http://localhost:5000`

## No local MongoDB

For demo work on a machine without MongoDB installed, run the backend with an in-memory MongoDB instance and automatic seed data:

```bash
npm.cmd run dev:demo --prefix server
```

This keeps data only while the backend process is running.

## Demo credentials

All demo users use password `Demo@1234`.

- `admin@adhikar.gov.in`
- `reviewer@adhikar.gov.in`
- `viewer@adhikar.gov.in`
# AI_Bharath
