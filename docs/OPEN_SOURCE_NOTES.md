# Open-source notes

This is the clean open-source edition of the Separated Kingdom GCWeb portal.

## Included

- Public pages
- Dashboard UI
- Node.js API server
- Generic install scripts
- Example Caddy config
- Example environment file
- Sanitized sample `site-data.json`
- Dashboard support-beam repair script

## Not included

The following must never be committed:

- `data/`
- SQLite databases
- accounts
- sessions
- service requests
- votes
- audit logs
- real Caddyfile with deployment-specific settings
- production `.env`
- backups
- private records
- real operational logs

## Dashboard data repair

If the dashboard opens but Easy Mode / Advanced JSON / Translation Checker is empty, run:

```bash
./scripts/repair-dashboard-content.sh
```

This restores missing public sample arrays from:

```text
public/assets/data/site-data.bundled-example.json
```

It does not touch runtime DB files.

## Before publishing

Run a secret scan for your own deployment paths, domains, hashes and tokens. No dashboard Basic Auth hash is required; dashboard login is handled by the app.


## v3 dashboard JavaScript fix

The dashboard page HTML must include the correct page-specific dashboard script.
Run:

```bash
./scripts/verify-dashboard-scripts.sh
```

This checks that dashboard pages are not accidentally loading `public-records.js` instead of their own dashboard scripts.
