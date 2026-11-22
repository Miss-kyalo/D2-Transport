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
`JWT_SECRET` is required; production requires at least 32 characters and
rejects the old development default. Generate a unique random secret for each
environment (for example, `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
Rotating it invalidates existing sessions.
Start PostgreSQL, then run the API and frontend in separate terminals:

```sh
export POSTGRES_PASSWORD='choose-a-local-database-password'
export JWT_SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")"
docker compose up -d db
npm --prefix backend run dev
npm --prefix frontend run dev
```

After the initial schema has been installed, apply the application migrations
to the database configured in `backend/.env`:

```sh
cd backend
node migrate.js
node scripts/smokeTest.js
```

`migrate.js` applies migrations `005` through `010` and `012` through `018` in order; the initial schema
must already be present. The smoke check verifies the compliance helper and
table presence, not the HTTP Gate-In/Gate-Out flow.

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
requires `GEMINI_API_KEY`. Run `node migrate.js` after updating the backend
to add the shared-workbench schema and Storekeeper role.

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
This view does not provide a P9 or include legacy driver payslips.

The `/control` page shows the existing garage inventory ledger and, for permitted
fleet and accounting roles, daily mileage and fuel records. Save only changed
mileage rows; readings must not decrease. Fuel entries are flagged when references
are missing or efficiency is low, but are not independently verified with the
fuel provider or KRA. The finance tab shows receivable invoices and bank ledger
entries; Accounts Payable, Accounts Receivable and Boss may record bank entries,
which remain unreconciled until independently checked. Petty cash and additional
inventory controls from the proposed hub are not yet enabled.

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
