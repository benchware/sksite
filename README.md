# Separated Kingdom GCWeb Portal

Open-source static portal and lightweight Node.js API for a GCWeb/Canada.ca-style government website.

This is a **clean sample/open-source edition**. It does not include live deployment secrets, real accounts, service requests, votes, audit logs, sessions, or production databases.

## Features

- English and German public site
- Canada.ca/GCWeb-inspired layout
- Public services and records pages
- Public account sign-in flow
- Dashboard UI
- Content editing
- Public record request workflow
- Service request workflow
- Emergency Alert System
- Official Campaigns / Public Notices
- Election ballot / voting system
- Status dashboard
- Backups and audit views
- Caddy reverse proxy example
- SQLite or JSON fallback runtime storage
- Dashboard support-beam self-repair from bundled example data

## Repository layout

```text
public/                  Static website and dashboard UI
server/                  Node.js API server
scripts/                 Generic install, upgrade and repair scripts
examples/                Example configs and sample data
docs/                    Open-source/deployment notes
Caddyfile.example        Example Caddy config
.env.example             Example environment file
LICENSE                  MIT license
```

## Quick start

```bash
npm install
node server/index.js
```

Then serve `public/` with your web server.

For Caddy:

```bash
cp Caddyfile.example Caddyfile
```

## Repair dashboard sample content

If Easy Mode, Advanced JSON, Translation Checker, campaigns, alerts, elections, or news are empty:

```bash
./scripts/repair-dashboard-content.sh
./scripts/check-public-content-counts.sh
```

The repair fills missing public sample arrays from:

```text
public/assets/data/site-data.bundled-example.json
```

It does **not** touch runtime DB files.

## Environment

```text
PORT=8787
DB_MODE=sqlite
DATA_DIR=./data
DATA_FILE=./public/assets/data/site-data.json
DB_FILE=./data/separated-kingdom.sqlite
BUNDLED_CONTENT_FILE=./public/assets/data/site-data.bundled-example.json
```

## Security

Do not commit:

```text
data/
*.sqlite
.env
Caddyfile
backup-*/
real site-data.json containing private records
account/session/vote/request/audit data
```

See `docs/OPEN_SOURCE_NOTES.md`.

## License

Code is released under the MIT License.

Bundled SVG assets and external image references may have separate licensing considerations. See `docs/IMAGE_CREDITS.md`.


## Open-source v3 dashboard JavaScript loader fix

Fixed:
- Dashboard pages were loading only `site.js` and the wrong `public-records.js`.
- Dashboard pages now load their correct page-specific JavaScript:
  - `dashboard-advanced.js`
  - `dashboard-easy.js`
  - `dashboard-translation-check.js`
  - `dashboard-security.js`
  - `dashboard-campaigns.js`
  - `dashboard-alerts.js`
  - `dashboard-elections.js`
  - plus accounts, requests, audit, backups and status scripts.

Verify:

```bash
./scripts/verify-dashboard-scripts.sh
./scripts/check-public-content-counts.sh
```


## Open-source v4 dashboard text/style repair

Fixed:
- Easy Mode editor form labels and legends were cramped/colliding.
- EN/DE bilingual editor columns now have cleaner spacing.
- Inputs and textareas use better readable sizing.
- Long titles/descriptions no longer visually break the form.
- CSS/JS cache-busted to oss4.

This is a visual/form styling fix only.


## OSS v5 dashboard web login and admin-account auth

Changed:
- Removed traditional browser Basic Auth prompt from dashboard/API routing.
- Added web login pages:
  - `/dashboard/login/`
  - `/dashboard/de/login/`
- Added app cookie auth endpoints:
  - `POST /admin-auth/login`
  - `GET /admin-auth/me`
  - `GET /admin-auth/check`
  - `POST /admin-auth/logout`
- Dashboard/API routes are protected by Caddy `forward_auth` plus server-side `/api/*` auth checks.
- Admin/editor/viewer accounts created in the dashboard account database can now sign in to the dashboard.
- A bootstrap `admin` account is created only when no dashboard admin/editor/viewer account exists.
- The bootstrap password is generated and stored on the server at:
  - `data/admin-initial-password.txt`
- Delete the bootstrap password file after saving the password securely.

Verify:
```bash
./scripts/verify-dashboard-auth.sh
./scripts/verify-dashboard-scripts.sh
./scripts/verify-dashboard-style.sh
```


## OSS v6 security hardening

Added:
- Login rate limiting by IP and username.
- Account lockout after repeated failed dashboard login attempts.
- CSRF token enforcement for admin/API mutating requests.
- Server-side dashboard session expiry.
- Role permissions:
  - admin: full access
  - editor: content/workflow changes only
  - viewer: read-only dashboard access
- Forced password change for bootstrap and newly created dashboard accounts.
- Password change/security settings page:
  - `/dashboard/change-password/`
  - `/dashboard/de/change-password/`
- Optional TOTP two-factor authentication.
- Safer content saving via server-side string sanitization.
- Node API binds to `127.0.0.1` by default through `HOST`.
- CORS allowlist now includes `X-CSRF-Token` for same-origin admin requests.
- Sensitive MFA secret is not returned by normal user/account APIs.

Verify:
```bash
./scripts/verify-dashboard-auth.sh
./scripts/verify-security-hardening.sh
./scripts/verify-dashboard-scripts.sh
./scripts/verify-dashboard-style.sh
```


## Open-source v7 dashboard quick navigation

Added:
- Persistent dashboard quick navigation bar on all dashboard pages.
- Back button.
- Dashboard home shortcut.
- Quick links to Easy Mode, Advanced JSON, Accounts, Requests, Campaigns, Alerts, Elections and Security.
- Public site shortcut.
- English and German labels.
- Mobile-friendly wrapping.

Verify:
```bash
./scripts/verify-dashboard-nav.sh
```


## Open-source v8 admin password reset recovery

Added:
- `./scripts/reset-admin-password.sh`
- `./scripts/verify-admin-reset.sh`

Why:
- `data/admin-initial-password.txt` is only generated when the server creates a bootstrap admin.
- If a dashboard admin/editor/viewer account already exists, the bootstrap password file is not generated.
- This script creates or resets the `admin` account and writes a recovery password file.

Use:
```bash
./scripts/reset-admin-password.sh
```

The reset admin is forced to change password after login.


## Open-source v9 login page cleanup

Removed:
- Visible “First-time setup” box from `/dashboard/login/`.
- Visible “Ersteinrichtung” box from `/dashboard/de/login/`.

Admin recovery now belongs in the server-side script:
```bash
./scripts/reset-admin-password.sh
```

Verify:
```bash
./scripts/verify-login-clean.sh
```


## Open-source v10 polished dashboard login

Improved:
- Modern two-column login layout.
- Large secure administration portal hero panel.
- Cleaner sign-in card.
- Better spacing, labels, focus rings and mobile layout.
- Security trust chips.
- No visible setup/recovery notes on the login page.

Verify:
```bash
./scripts/verify-login-style.sh
```


## Open-source v11 GCWeb-style login restoration

Changed:
- Replaced the modern/SaaS-style dashboard login with a GCWeb-style layout.
- Uses standard container, rows, form groups, well and panel elements.
- Removed the large custom hero panel.
- Kept dashboard web-login, MFA field, CSRF/session security and admin reset support.

Verify:
```bash
./scripts/verify-login-gcweb.sh
```


## Open-source v12 request workflow cleanup

Fixed:
- Added public Request centre:
  - `/en/requests/`
  - `/de/requests/`
- Added public request status lookup:
  - `/en/request-status/`
  - `/de/request-status/`
- Added `/account-api/request-status` endpoint.
- Record requests now clearly separate public records and private/case records.
- Record request form includes a record tag/case number/file number field.
- Request forms now show a clear success message with reference number and status-check button.
- Services page now points users to the request centre instead of confusing category hunting.
- Dashboard requests page now shows details, record tags and decision notes that users can see on status lookup.

Verify:
```bash
./scripts/verify-request-workflow.sh
```


## Open-source v13 public menu consistency fix

Fixed:
- Re-added the GCWeb-style menu block to public pages that were created/rewritten without it.
- Added Request centre and Request status to the public menu.
- Added `./scripts/verify-public-menu.sh`.

Verify:
```bash
./scripts/verify-public-menu.sh
```


Patched public pages missing menu block:

```text
/de/records/index.html
/de/services/index.html
/de/requests/index.html
/de/request-status/index.html
/de/services/transit-access-permit/index.html
/de/services/report-infrastructure-issue/index.html
/de/records/request/index.html
/en/records/index.html
/en/services/index.html
/en/requests/index.html
/en/request-status/index.html
/en/services/transit-access-permit/index.html
/en/services/report-infrastructure-issue/index.html
/en/records/request/index.html
```


## Open-source v14 homepage quick-link cleanup

Fixed:
- Most requested strip was too visually loud and looked broken.
- Homepage visited links no longer turn overpowering purple in the quick-link/topic sections.
- Services and information grid has tighter spacing and more GCWeb-like link colour.
- Corrected confusing German copy introduced by earlier replacement.

Verify:
```bash
./scripts/verify-homepage-cleanup.sh
```


## Open-source v15 stronger German homepage cleanup

Fixed:
- German homepage now gets a stronger visited-link colour override.
- German most-requested strip has tighter German-specific spacing.
- Removed remaining broken German wording from earlier replacements.
- Cache-busted CSS/JS to oss15.

Verify:
```bash
./scripts/verify-de-homepage-cleanup.sh
```


## Open-source v16 German homepage topic-grid fix

Fixed:
- German homepage Services and information section no longer uses Bootstrap float wrapping.
- Topic cards now use a real responsive CSS grid.
- This removes the large vertical gap caused by long German headings wrapping to two lines.

Verify:
```bash
./scripts/verify-homepage-topic-grid.sh
```


## Open-source v17 homepage topic-grid clearfix fix

Fixed:
- Bootstrap `.row::before` and `.row::after` clearfix pseudo-elements were being treated as invisible CSS-grid items.
- That pushed the first real topic card into column 2 and made the German and English homepages look broken.
- The homepage topics grid now disables those pseudo-elements inside `.sk-ca-topics` only.

Verify:
```bash
./scripts/verify-homepage-clearfix-grid.sh
./scripts/verify-homepage-topic-grid.sh
```


## Open-source v18 Records Registry and auto case numbers

Added:
- Dashboard Records Registry:
  - `/dashboard/records-registry/`
  - `/dashboard/de/records-registry/`
- Create public, private and restricted records.
- Auto case-number generation:
  - `PUB-YYYY-XXXXXX` for public records
  - `PRV-YYYY-XXXXXX` for private/case records
  - `RST-YYYY-XXXXXX` for restricted records
- Published public registry records automatically appear on `/records/`.
- Private/restricted records stay hidden from `/records/`.
- Public status lookup now supports request reference numbers and registry case numbers.
- Dashboard quick navigation includes Records Registry.

Verify:
```bash
./scripts/verify-records-registry.sh
```
