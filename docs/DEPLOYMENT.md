# Deployment quick start

## 1. Install Node.js

Node.js 24+ is recommended because this project can use the built-in SQLite module.

## 2. Configure environment

```bash
cp .env.example .env
```

Adjust values as needed.

## 3. Configure Caddy

```bash
cp Caddyfile.example Caddyfile
caddy hash-password --plaintext 'your-password'
```

Replace `APP_COOKIE_LOGIN` in `Caddyfile`.

## 4. Run locally

```bash
node server/index.js
```

## 5. Repair dashboard sample content if needed

```bash
./scripts/repair-dashboard-content.sh
./scripts/check-public-content-counts.sh
```

## 6. Install as service

```bash
chmod +x scripts/*.sh
./scripts/install-all.sh
```
