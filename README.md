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

Configure separate database admin/runtime passwords and a JWT secret. Production
JWT and runtime DB secrets must each be at least 32 characters; generate unique
random values per environment, and rotate JWT secrets only as a planned
session-invalidating event. Add `GEMINI_API_KEY` to enable garage image
inspection. Compose reads these values from environment variables or a
project-root `.env` file and does not use hard-coded credentials.

For local development with Compose PostgreSQL and a host-run backend:

```sh
export POSTGRES_PASSWORD="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
export APP_DB_USER='d2_app'
export APP_DB_PASSWORD="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
export JWT_SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
docker compose up -d db
docker compose run --rm migrator
export PGHOST=localhost PGPORT=5432 PGUSER="$APP_DB_USER" PGPASSWORD="$APP_DB_PASSWORD"
npm --prefix backend run dev
npm --prefix frontend run dev
```

## Production deployment baseline

The Compose stack binds PostgreSQL and the API only to loopback
(`127.0.0.1:5432` and `127.0.0.1:5000`), so neither is publicly exposed by
Compose. Put a maintained TLS reverse proxy in front of the API,
expose only HTTPS publicly, restrict host firewall access, and set
`TRUST_PROXY_CIDRS` to the proxy's exact source IPs/CIDRs. If the browser app is
served from a different origin, set `CORS_ORIGINS` to a comma-separated list
of exact `https://` origins; do not use `*`. Without an origin list, production
API access is same-origin only.

Back up PostgreSQL and uploads before deployments, test restore procedures, and
review migration output before promoting a release. The API container runs as
an unprivileged user with a read-only root filesystem; uploads remain in
`backend/uploads` on the host. Preserve that directory when deploying existing
records, restrict host access, and ensure it is writable by the container's
`node` user (UID/GID 1000). For external PostgreSQL, set `PGSSL=true` to validate TLS certificates, and
optionally set `PGSSL_CA` to a mounted CA bundle path. Set a distinct
`APP_DB_USER` and an `APP_DB_PASSWORD` of at least 32 random characters.
Configure secrets using a protected deployment secret store, not source
control, chat, or a committed `.env` file. Keep `EMAIL_MFA_ENABLED=false`
until SMTP delivery and account email addresses have been tested; after that,
enable it as a planned rollout because staff must sign in again.

These settings are a deployment baseline, not a production-readiness
certification. Before launch, complete a security review, verify least-privilege
database credentials, test backup restoration and incident response, and run
role-specific end-to-end acceptance tests against the actual deployment.

```sh
docker compose up -d db
docker compose run --rm migrator
docker compose up -d backend
```

For a new database, initialization creates only the base schema; the migrator
applies application migrations and provisions the runtime database role before
the backend is started. In deployments, source `POSTGRES_PASSWORD`,
`APP_DB_PASSWORD`, and `JWT_SECRET` from a secret manager, not shell history or
a committed `.env` file.

`migrate.js` serializes runs with a PostgreSQL advisory lock, records each
success in `schema_migrations`, and grants the distinct application role only
data access to existing and future public-schema tables/sequences. Legacy
databases without a migration ledger will safely re-run the idempotent
migration list once and then track subsequent runs. Use the same migration
account for future releases. Do not start the API before migration/provisioning
has completed.

The public garage overview is available at `/garage`. After logging in with an
Admin, Mechanic, FleetManager, or Storekeeper account, the shared workbench is
available at `/garage/workbench`. Select a work order created in
`/garage/department`, assign its driver and mechanic, and request parts by
inventory ID and name. An Admin or Storekeeper must reserve or reject requests
and issue reserved parts; issuing deducts stock. Rejecting a reservation
releases it. Open parts requests must be resolved before completing the order.
New issues add the stock unit cost at the time of issue to the existing parts
cost and total estimate, and retain the unit-cost snapshot on the request. Older
issues are not retroactively repriced. Because inventory costs are in KES,
issuing to non-KES work orders is blocked until currency conversion is available.
The historical job-card workflow remains separate; its AI image inspection
requires `GEMINI_API_KEY`. Run `docker compose run --rm migrator` after updating
the backend to apply database migrations and provision the runtime role.

Drivers can submit a pre-arrival fault and spares alert from their dashboard,
including an optional name when reporting for someone else. The garage workbench
shows the reporting user and that name; Admin or Storekeeper can mark spares
as staged. Staging an alert does not reserve or issue inventory.
Boss can view payroll at `/payroll`; payroll runs and profile edits remain
restricted to PayrollAccountant. HR can create Boss, accounting, and other staff
accounts from `/hr/leave`; staff accounts remain pending until the existing
document verification process is complete.
Staff can view their own recorded statutory payslips and annual payroll summary
at `/my-payslips`. Payroll calculations become visible there as soon as they
are saved; the system does not yet have a payroll finalization workflow.
The annual view provides a printable PAYE/P9 support schedule from stored
calculations; payroll must verify it against the current KRA P9 form before
filing. Driver accounts also see their separate, read-only legacy payslip
history.

The `/control` page shows the existing garage inventory ledger and, for permitted
fleet and accounting roles, daily mileage and fuel records. Save only changed
mileage rows; readings must not decrease. Fuel entries are flagged when references
are missing or efficiency is low, but are not independently verified with the
fuel provider or KRA. The finance tab shows receivable invoices and bank ledger
entries; Accounts Payable, Accounts Receivable and Boss may record bank entries,
which remain unreconciled until independently checked. Petty cash and additional
inventory controls from the proposed hub are not yet enabled.

To create local demo logins for every application role, first apply the base
schema and application migrations, then run:

```sh
DEMO_ACCOUNT_PASSWORD='choose-a-password-of-at-least-12-characters' \
  npm --prefix backend run seed:demo
```

All demo accounts use the supplied password and have no phone number. Their
usernames are `demo_admin`, `demo_hr`, `demo_accounts_payable`,
`demo_accounts_receivable`, `demo_payroll_accountant`, `demo_boss`,
`demo_dispatcher`, `demo_fleet_manager`, `demo_mechanic`, `demo_storekeeper`,
`demo_driver`, `demo_manufacturer`, `demo_client`, and `demo_spot_client`.
The seed can be rerun to reset their shared password; it refuses to overwrite
an existing account unless its demo email matches. Demo accounts do not create
sample trips or trucks. Use this only with a local/test database, never
production. Leave `EMAIL_MFA_ENABLED=false` for these fake-email staff accounts.

Depot operations are available at `/depot`. Gate-Out checks active holds,
damage, and cleaning; sanitization and KEPHIS clearance can also be required
for an individual release. License attachments are stored in
`backend/uploads/depot`.
Uploads are downloadable through authenticated `/uploads` routes only, with
access checked against the associated record. Configure production proxies and
storage so they cannot serve the uploads directory directly. Document uploads
are limited to 10 MB per file.

Login requests are limited to 20 per username and client address, and 100 per
client address, in 15 minutes. The limit uses PostgreSQL and fails closed if
the database is unavailable. For production, terminate TLS at a trusted reverse
proxy, restrict API access to that proxy, and set `TRUST_PROXY_CIDRS` to a
comma-separated list of the proxy's actual IP addresses or CIDR ranges. Do not
trust arbitrary client-supplied forwarding headers. With no setting, Express
uses the direct peer address; behind a proxy this can group users together.

Sign-ins use server-side sessions: logout revokes the current session, and
account suspension or role changes take effect on the next request. Deploying
this change signs out existing sessions.

Email MFA is staged off by default. Configure `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` privately on the backend, verify
that every staff account has a working registered email, and test delivery
before setting `EMAIL_MFA_ENABLED=true`. Port 465 uses TLS; other ports require
STARTTLS. When enabled, all staff must enter a single-use code sent to their
registered email; clients and manufacturers retain password-only login. Staff
login fails if delivery is unavailable. Codes expire in ten minutes and allow
five attempts. Enabling MFA invalidates existing staff sessions until they sign
in again with a code.

Admins and Fleet Managers can import trucks at `/fleet`. Download the Excel
template, enter plate number, model, and capacity in tons on the `Trucks`
sheet, and refer to the separate example sheet. Upload an `.xlsx` file of at
most 5 MB and 1,000 data rows; duplicate plates or invalid rows reject the
entire import without adding any trucks.

The frontend uses `http://localhost:5000/api` by default. Set
`VITE_API_BASE_URL` when the API is available at a different URL.

## Validate

```sh
npm --prefix frontend run lint
npm --prefix frontend run build
```
