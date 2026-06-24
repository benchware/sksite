#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PUBLIC="${APP_DIR}/public"

node - <<'NODE' "${PUBLIC}"
const fs = require('fs');
const path = require('path');
const publicDir = process.argv[2];

function walk(dir){
  const out = [];
  for(const name of fs.readdirSync(dir)){
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if(st.isDirectory()) out.push(...walk(p));
    else if(name.endsWith('.html')) out.push(p);
  }
  return out;
}

let ok = true;

for(const file of walk(publicDir)){
  const rel = '/' + path.relative(publicDir, file).replace(/\\/g, '/');
  if(rel === '/index.html') continue;
  if(rel.includes('/404/') || rel.includes('/dashboard/')) continue;
  if(!rel.startsWith('/en/') && !rel.startsWith('/de/')) continue;
  const html = fs.readFileSync(file, 'utf8');
  if(!html.includes('gcweb-menu sk-simple-menu') || !html.includes('sk-menu-list')){
    ok = false;
    console.log('Missing menu block:', rel);
  }
}

if(!ok) process.exit(1);
console.log('Public menu block check passed.');
NODE
