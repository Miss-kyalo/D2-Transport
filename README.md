# D2 Transport

D2 Transport is a transport operations application with a React frontend, an
Express API, and a PostgreSQL database.

## Project layout

- `backend/` contains the API, database migrations, and upload handling.
- `frontend/` contains the React application and Vite configuration.
- `docker-compose.yml` defines the PostgreSQL and API containers.

## Install dependencies

From the repository root:

```sh
npm --prefix backend install
npm --prefix frontend install
```

## Run locally

Configure `backend/.env` with `DATABASE_URL`, `JWT_SECRET`, and `PORT`. Start
PostgreSQL with Docker Compose, then run the API and frontend in separate
terminals:

```sh
docker compose up -d db
npm --prefix backend run dev
npm --prefix frontend run dev
```

Apply the depot migration to the database configured in `backend/.env` after
the initial schema has been installed:

```sh
cd backend
node -e "require('dotenv').config(); const fs = require('fs'); const { Client } = require('pg'); const db = new Client({ connectionString: process.env.DATABASE_URL }); (async () => { try { await db.connect(); await db.query(fs.readFileSync('migrations/005_depot_compliance.sql', 'utf8')); console.log('Depot migration applied.'); } catch (err) { console.error(err.message); process.exitCode = 1; } finally { await db.end(); } })();"
```

Depot operations are available at `/depot`. Gate-Out checks active holds,
damage, and cleaning; sanitization and KEPHIS clearance can also be required
for an individual release. License attachments are stored in
`backend/uploads/depot`.

The frontend uses `http://localhost:5000/api` by default. Set
`VITE_API_BASE_URL` when the API is available at a different URL.

## Validate

```sh
npm --prefix frontend run lint
npm --prefix frontend run build
```
