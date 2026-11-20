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
node migrate.js
node scripts/smokeTest.js
```

`migrate.js` applies the depot migration only; the initial schema must already
be present. The smoke check verifies the compliance helper and table presence,
not the HTTP Gate-In/Gate-Out flow.

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
