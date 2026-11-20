# Difan Logistics

Difan Logistics is a transport operations application with a React frontend, an
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

For local API runs, configure `backend/.env` with `DATABASE_URL`, `JWT_SECRET`,
and `PORT`; add `GEMINI_API_KEY` to enable garage image inspection. Docker
Compose reads `POSTGRES_PASSWORD` and `JWT_SECRET` from the shell or a
project-root `.env` file; set `GEMINI_API_KEY` there to enable the same feature.
Compose does not use hard-coded credentials.
Start PostgreSQL, then run the API and frontend in separate terminals:

```sh
export POSTGRES_PASSWORD='choose-a-local-database-password'
export JWT_SECRET='choose-a-local-signing-secret'
docker compose up -d db
npm --prefix backend run dev
npm --prefix frontend run dev
```

After the initial schema has been installed, apply the depot, garage, and
M-Pesa migrations to the database configured in `backend/.env`:

```sh
cd backend
node migrate.js
node scripts/smokeTest.js
```

`migrate.js` applies migrations `005` through `008` in order; the initial schema
must already be present. The smoke check verifies the compliance helper and
table presence, not the HTTP Gate-In/Gate-Out flow.

The public garage overview is available at `/garage`. After logging in with an
Admin or Mechanic account, the job-card workbench is available at
`/garage/workbench`. Its AI image inspection requires `GEMINI_API_KEY`.

To create local demo logins for every application role, first set the initial
schema up, then run:

```sh
DEMO_ACCOUNT_PASSWORD='choose-a-password-of-at-least-12-characters' \
  npm --prefix backend run seed:demo
```

All demo accounts use the supplied password and have no phone number. The seed
can be rerun to reset their password; it refuses to overwrite an existing
account unless its demo email matches. Logins with web portals are `demo_admin`,
`demo_fleet_manager`, `demo_driver`, `demo_manufacturer`, `demo_client`, and
`demo_spot_client`. Other roles are for API permission testing. Demo accounts
do not create sample trips or trucks. Use this only with a local/test database,
never production.

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
