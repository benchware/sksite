#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
JS="${APP_DIR}/public/assets/js/admin-nav.js"
CSS="${APP_DIR}/public/assets/css/site.css"

if [ ! -f "${JS}" ]; then
  echo "Missing admin-nav.js"
  exit 1
fi

if ! grep -q "dashboard-quick-nav" "${JS}"; then
  echo "admin-nav.js is missing dashboard quick nav marker"
  exit 1
fi

if ! grep -q "dashboard quick navigation" "${CSS}"; then
  echo "site.css is missing dashboard quick nav styles"
  exit 1
fi

node --check "${JS}"

node - <<'NODE' "${APP_DIR}"
const fs = require('fs');
const path = require('path');
const app = process.argv[2];
const publicDir = path.join(app, 'public');

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

let ok = true;
for(const file of walk(path.join(publicDir, 'dashboard'))){
  const rel = path.relative(publicDir, file).replace(/\\/g, '/');
  if(rel.includes('/login/')) continue;
  const html = fs.readFileSync(file, 'utf8');
  if(!html.includes('/assets/js/admin-nav.js')){
    ok = false;
    console.log('Missing admin-nav.js on', rel);
  }
}
if(!ok) process.exit(1);
console.log('Dashboard quick navigation check passed.');
NODE
