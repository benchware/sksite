#!/usr/bin/env bash
set -euo pipefail

# Create or reset a dashboard admin account.
# This is a local/server-side recovery tool. Do not expose this script through the web.

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DATA_DIR="${DATA_DIR:-${APP_DIR}/data}"
DB_FILE="${DB_FILE:-${DATA_DIR}/separated-kingdom.sqlite}"
USERS_FILE="${USERS_FILE:-${DATA_DIR}/users.json}"
OUTPUT_FILE="${OUTPUT_FILE:-${DATA_DIR}/admin-initial-password.txt}"

ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.local}"
ADMIN_DISPLAY_NAME="${ADMIN_DISPLAY_NAME:-System Administrator}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

mkdir -p "${DATA_DIR}"

node - <<'NODE' "${DB_FILE}" "${USERS_FILE}" "${OUTPUT_FILE}" "${ADMIN_USERNAME}" "${ADMIN_EMAIL}" "${ADMIN_DISPLAY_NAME}" "${ADMIN_PASSWORD}"
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [dbFile, usersFile, outputFile, username, email, displayName, providedPassword] = process.argv.slice(2);

function hashPassword(p, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(p), salt, 160000, 32, 'sha256').toString('hex');
  return salt + ':' + hash;
}

function generatedPassword() {
  return crypto.randomBytes(18).toString('base64url') + '-A1!';
}

const password = providedPassword && providedPassword.trim() ? providedPassword.trim() : generatedPassword();
const now = new Date().toISOString();
const id = crypto.randomUUID();

let used = 'json';

try {
  if (fs.existsSync(dbFile)) {
    const sqlite = require('node:sqlite');
    const DatabaseSync = sqlite.DatabaseSync;
    const db = new DatabaseSync(dbFile);

    const accountCols = db.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
    const sessionCols = db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);

    function addAccount(name, type) {
      if (!accountCols.includes(name)) db.exec(`ALTER TABLE accounts ADD COLUMN ${name} ${type}`);
    }
    function addSession(name, type) {
      if (!sessionCols.includes(name)) db.exec(`ALTER TABLE sessions ADD COLUMN ${name} ${type}`);
    }

    addAccount('mustChangePassword', 'INTEGER DEFAULT 0');
    addAccount('failedLoginCount', 'INTEGER DEFAULT 0');
    addAccount('lockedUntil', 'TEXT DEFAULT ""');
    addAccount('lastLoginAt', 'TEXT DEFAULT ""');
    addAccount('mfaSecret', 'TEXT DEFAULT ""');
    addAccount('mfaEnabled', 'INTEGER DEFAULT 0');

    // These may be needed if the DB was created before the hardened dashboard version.
    if (sessionCols.length) {
      addSession('csrfToken', 'TEXT DEFAULT ""');
      addSession('expiresAt', 'TEXT DEFAULT ""');
      addSession('purpose', 'TEXT DEFAULT ""');
    }

    const existing = db.prepare('SELECT id FROM accounts WHERE lower(username) = lower(?)').get(username);
    if (existing) {
      db.prepare(`UPDATE accounts
        SET email = ?, displayName = ?, accountType = 'admin', passwordHash = ?,
            mustChangePassword = 1, failedLoginCount = 0, lockedUntil = '',
            mfaSecret = '', mfaEnabled = 0
        WHERE id = ?`)
        .run(email, displayName, hashPassword(password), existing.id);
      db.prepare('DELETE FROM sessions WHERE userId = ?').run(existing.id);
      used = 'sqlite-update';
    } else {
      db.prepare(`INSERT INTO accounts
        (id, username, email, displayName, accountType, createdAt, passwordHash,
         mustChangePassword, failedLoginCount, lockedUntil, lastLoginAt, mfaSecret, mfaEnabled)
        VALUES (?, ?, ?, ?, 'admin', ?, ?, 1, 0, '', '', '', 0)`)
        .run(id, username, email, displayName, now, hashPassword(password));
      used = 'sqlite-create';
    }

    db.close();
  } else {
    let users = [];
    try {
      if (fs.existsSync(usersFile)) users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    } catch (e) {
      users = [];
    }

    const idx = users.findIndex(u => String(u.username || '').toLowerCase() === String(username).toLowerCase());
    const user = {
      id: idx >= 0 ? users[idx].id : id,
      username,
      email,
      displayName,
      accountType: 'admin',
      createdAt: idx >= 0 ? (users[idx].createdAt || now) : now,
      passwordHash: hashPassword(password),
      mustChangePassword: 1,
      failedLoginCount: 0,
      lockedUntil: '',
      lastLoginAt: '',
      mfaSecret: '',
      mfaEnabled: 0
    };

    if (idx >= 0) {
      users[idx] = {...users[idx], ...user};
      used = 'json-update';
    } else {
      users.push(user);
      used = 'json-create';
    }

    fs.mkdirSync(path.dirname(usersFile), {recursive: true});
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  }

  const text = [
    'Separated Kingdom dashboard admin reset',
    'username: ' + username,
    'password: ' + password,
    'mode: ' + used,
    'created: ' + now,
    '',
    'Open /dashboard/login/ and sign in.',
    'You will be forced to change this password.',
    'Delete this file after saving the password securely.'
  ].join('\n');

  fs.mkdirSync(path.dirname(outputFile), {recursive: true});
  fs.writeFileSync(outputFile, text, {encoding: 'utf8', mode: 0o600});

  console.log(text);
} catch (e) {
  console.error('Admin reset failed:', e && e.stack ? e.stack : e);
  process.exit(1);
}
NODE

echo
echo "Admin password recovery file:"
echo "  ${OUTPUT_FILE}"
echo
echo "Restart the API after reset:"
echo "  sudo systemctl restart separated-kingdom-admin"
