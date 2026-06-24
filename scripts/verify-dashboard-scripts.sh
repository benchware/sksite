#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

node - <<'NODE' "${APP_DIR}"
const fs = require('fs');
const path = require('path');
const app = process.argv[2];
const publicDir = path.join(app, 'public');

const expected = {
  'accounts': 'dashboard-accounts.js',
  'advanced': 'dashboard-advanced.js',
  'alerts': 'dashboard-alerts.js',
  'audit': 'dashboard-audit.js',
  'backups': 'dashboard-backups.js',
  'campaigns': 'dashboard-campaigns.js',
  'easy': 'dashboard-easy.js',
  'elections': 'dashboard-elections.js',
  'requests': 'dashboard-requests.js',
  'security': 'dashboard-security.js',
  'status': 'dashboard-status.js',
  'translation-check': 'dashboard-translation-check.js'
};

function walk(dir){
  const out = [];
  for(const name of fs.readdirSync(dir)){
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if(st.isDirectory()) out.push(...walk(p));
    else if(name === 'index.html') out.push(p);
  }
  return out;
}
function keyFor(rel){
  const parts = rel.split(path.sep);
  if(parts[0] !== 'dashboard') return '';
  if(parts[1] === 'de') return parts[2] || '';
  return parts[1] || '';
}

let ok = true;
for(const file of walk(path.join(publicDir, 'dashboard'))){
  const rel = path.relative(publicDir, file);
  const key = keyFor(rel);
  const want = expected[key];
  const html = fs.readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
  if(scripts.some(s => s.includes('public-records.js'))){
    ok = false;
    console.log('BAD public-records.js on dashboard page:', rel);
  }
  if(want && !scripts.some(s => s.includes('/assets/js/' + want))){
    ok = false;
    console.log('MISSING', want, 'on', rel);
  }
}
if(!ok) process.exit(1);
console.log('Dashboard script check passed.');
NODE
