
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8787;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.join(__dirname, '..');
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'public', 'assets', 'data', 'site-data.json');
const BUNDLED_CONTENT_FILE = process.env.BUNDLED_CONTENT_FILE || path.join(ROOT, 'public', 'assets', 'data', 'site-data.bundled-example.json');
const PUBLIC_CONTENT_LIST_KEYS = [
  'news',
  'incidentReports',
  'advisories',
  'gazette',
  'services',
  'transparency',
  'records',
  'states',
  'departments',
  'organizations',
  'legalDocuments',
  'statusDashboard',
  'alerts',
  'campaigns',
  'elections'
];
const PUBLIC_CONTENT_OBJECT_KEYS = [
  'alertSettings',
  'campaignSettings',
  'votingSettings'
];
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'separated-kingdom.sqlite');

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');
const ADMIN_COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || 'sk_admin_session';
const ADMIN_SESSION_MAX_AGE_SECONDS = Number(process.env.ADMIN_SESSION_MAX_AGE_SECONDS || 28800);
const ADMIN_INITIAL_PASSWORD_FILE = process.env.ADMIN_INITIAL_PASSWORD_FILE || path.join(DATA_DIR, 'admin-initial-password.txt');
const ADMIN_LOGIN_RATE_WINDOW_MS = Number(process.env.ADMIN_LOGIN_RATE_WINDOW_MS || 15 * 60 * 1000);
const ADMIN_LOGIN_RATE_MAX = Number(process.env.ADMIN_LOGIN_RATE_MAX || 8);
const ADMIN_LOCKOUT_MINUTES = Number(process.env.ADMIN_LOCKOUT_MINUTES || 15);
const CSRF_HEADER = 'x-csrf-token';
const MUTATING_METHODS = new Set(['POST','PUT','PATCH','DELETE']);
const loginRateBuckets = new Map();

function ensureDir(){ if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true}); }
function initJsonFiles(){
  ensureDir();
  for(const [file, init] of [[USERS_FILE,[]],[REQUESTS_FILE,[]],[SESSIONS_FILE,[]],[AUDIT_FILE,[]],[VOTES_FILE,[]]]){
    if(!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(init,null,2), 'utf8');
  }
}
function send(res, code, type, body, extraHeaders={}){
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token, X-CSRF-Token',
    ...extraHeaders
  });
  res.end(body);
}
function json(res, code, obj, extraHeaders={}){ send(res, code, 'application/json', JSON.stringify(obj), extraHeaders); }
function readBody(req, cb){
  let b='';
  req.on('data', c => { b += c; if(b.length > 3000000) req.destroy(); });
  req.on('end', () => { try { cb(null, b ? JSON.parse(b) : {}); } catch(e){ cb(e); } });
}
function atomicWrite(file, text){
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}
function readJsonFile(file, fallback){
  try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch(e){ return fallback; }
}
function writeJsonFile(file, obj){ ensureDir(); atomicWrite(file, JSON.stringify(obj,null,2)); }
function hashPassword(p, salt=crypto.randomBytes(16).toString('hex')){
  const hash = crypto.pbkdf2Sync(String(p), salt, 160000, 32, 'sha256').toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(p, stored){
  const [salt, hash] = String(stored || '').split(':');
  if(!salt || !hash) return false;
  const actual = hashPassword(p, salt).split(':')[1];
  try { return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(actual)); } catch(e){ return false; }
}
function safeUser(u){
  if(!u) return u;
  const {passwordHash, password_hash, mfaSecret, ...rest} = u;
  if(rest.password_hash) delete rest.password_hash;
  if(rest.mfaSecret) delete rest.mfaSecret;
  rest.mfaEnabled = !!rest.mfaEnabled;
  rest.mustChangePassword = !!rest.mustChangePassword;
  return rest;
}
function makeRef(prefix){
  return prefix + '-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}
function getIp(req){ return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
function authToken(req){
  const h = req.headers.authorization || '';
  if(h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  return '';
}
function parseCookies(req){
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if(idx > -1){
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if(k) out[k] = decodeURIComponent(v);
    }
  });
  return out;
}
function shouldUseSecureCookie(req){
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const host = String(req.headers.host || '');
  if(process.env.ADMIN_COOKIE_SECURE === '1') return true;
  if(process.env.ADMIN_COOKIE_SECURE === '0') return false;
  return proto === 'https' || (!host.startsWith('127.0.0.1') && !host.startsWith('localhost'));
}
function adminCookie(token, req){
  const secure = shouldUseSecureCookie(req) ? '; Secure' : '';
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${ADMIN_SESSION_MAX_AGE_SECONDS}${secure}`;
}
function clearAdminCookie(req){
  const secure = shouldUseSecureCookie(req) ? '; Secure' : '';
  return `${ADMIN_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
function isDashboardAccount(u){
  const type = String((u && u.accountType) || '').toLowerCase();
  return ['admin','administrator','editor','viewer'].includes(type);
}
function getAdminUser(req){
  const cookies = parseCookies(req);
  const token = cookies[ADMIN_COOKIE_NAME] || authToken(req);
  const user = getAccountByToken(token);
  return isDashboardAccount(user) ? user : null;
}
function isAdminApiPath(pathname){
  if(pathname === '/api/health' || pathname === '/health') return false;
  if(pathname === '/content' || pathname === '/api/content') return true;
  return pathname.startsWith('/api/');
}
function safeParse(s, fallback){ try { return JSON.parse(s); } catch(e){ return fallback; } }

function migrateSqliteSecurityColumns(){
  if(dbMode !== 'sqlite' || !DB) return;
  const accountCols = DB.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
  const sessionCols = DB.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  const addAccount = (name, type) => { if(!accountCols.includes(name)) DB.exec(`ALTER TABLE accounts ADD COLUMN ${name} ${type}`); };
  const addSession = (name, type) => { if(!sessionCols.includes(name)) DB.exec(`ALTER TABLE sessions ADD COLUMN ${name} ${type}`); };
  addAccount('mustChangePassword', 'INTEGER DEFAULT 0');
  addAccount('failedLoginCount', 'INTEGER DEFAULT 0');
  addAccount('lockedUntil', 'TEXT DEFAULT ""');
  addAccount('lastLoginAt', 'TEXT DEFAULT ""');
  addAccount('mfaSecret', 'TEXT DEFAULT ""');
  addAccount('mfaEnabled', 'INTEGER DEFAULT 0');
  addSession('csrfToken', 'TEXT DEFAULT ""');
  addSession('expiresAt', 'TEXT DEFAULT ""');
  addSession('purpose', 'TEXT DEFAULT ""');
}
function nowIso(){ return new Date().toISOString(); }
function isoPlusSeconds(seconds){ return new Date(Date.now() + (Number(seconds)||0) * 1000).toISOString(); }
function isExpiredIso(value){ return !!value && Date.parse(value) <= Date.now(); }
function isLocked(u){ return !!(u && u.lockedUntil && isExpiredIso(u.lockedUntil) === false); }
function loginRateKey(req, username){ return getIp(req) + ':' + String(username || '').toLowerCase(); }
function rateLimitLogin(req, username){
  const key = loginRateKey(req, username);
  const now = Date.now();
  const entry = loginRateBuckets.get(key) || {first:now, count:0};
  if(now - entry.first > ADMIN_LOGIN_RATE_WINDOW_MS){
    entry.first = now;
    entry.count = 0;
  }
  entry.count++;
  loginRateBuckets.set(key, entry);
  return entry.count <= ADMIN_LOGIN_RATE_MAX;
}
function resetRateLimit(req, username){ loginRateBuckets.delete(loginRateKey(req, username)); }
function updateAccountSecurity(userId, patch){
  if(!userId) return;
  const clean = {...patch};
  if(dbMode === 'sqlite'){
    const fields = Object.keys(clean).filter(Boolean);
    if(!fields.length) return;
    const sets = fields.map(k => `${k} = ?`).join(', ');
    DB.prepare(`UPDATE accounts SET ${sets} WHERE id = ?`).run(...fields.map(k => clean[k]), userId);
    return;
  }
  const users = getAccounts();
  const idx = users.findIndex(u => u.id === userId);
  if(idx >= 0){
    users[idx] = {...users[idx], ...clean};
    writeJsonFile(USERS_FILE, users);
  }
}
function recordLoginFailure(u){
  if(!u) return;
  const count = Number(u.failedLoginCount || 0) + 1;
  const patch = {failedLoginCount: count};
  if(count >= 5) patch.lockedUntil = new Date(Date.now() + ADMIN_LOCKOUT_MINUTES * 60 * 1000).toISOString();
  updateAccountSecurity(u.id, patch);
}
function recordLoginSuccess(u){
  if(!u) return;
  updateAccountSecurity(u.id, {failedLoginCount:0, lockedUntil:'', lastLoginAt:nowIso()});
}
function csrfMatches(req, session){
  if(!session || !session.csrfToken) return false;
  const header = req.headers[CSRF_HEADER] || req.headers[CSRF_HEADER.toLowerCase()];
  if(!header) return false;
  try{
    return crypto.timingSafeEqual(Buffer.from(String(header)), Buffer.from(String(session.csrfToken)));
  }catch(e){ return false; }
}
function base32Encode(buffer){
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '', out = '';
  for(const b of buffer) bits += b.toString(2).padStart(8,'0');
  for(let i=0; i<bits.length; i+=5){
    const chunk = bits.slice(i, i+5).padEnd(5,'0');
    out += alphabet[parseInt(chunk,2)];
  }
  return out;
}
function base32Decode(s){
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  String(s || '').toUpperCase().replace(/=+$/,'').replace(/[^A-Z2-7]/g,'').split('').forEach(ch => {
    const val = alphabet.indexOf(ch);
    if(val >= 0) bits += val.toString(2).padStart(5,'0');
  });
  const bytes = [];
  for(let i=0; i+8<=bits.length; i+=8) bytes.push(parseInt(bits.slice(i,i+8),2));
  return Buffer.from(bytes);
}
function totp(secret, step=30, digits=6, now=Date.now()){
  const counter = Math.floor(now / 1000 / step);
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset+1] << 16) | (hmac[offset+2] << 8) | hmac[offset+3];
  return String(code % (10 ** digits)).padStart(digits, '0');
}
function verifyTotp(secret, code){
  const c = String(code || '').replace(/\s+/g,'');
  if(!/^\d{6}$/.test(c)) return false;
  for(const drift of [-1,0,1]){
    if(totp(secret, 30, 6, Date.now() + drift * 30000) === c) return true;
  }
  return false;
}
function generateMfaSecret(){ return base32Encode(crypto.randomBytes(20)); }
function roleOf(user){ return String((user && user.accountType) || '').toLowerCase(); }
function canAccessAdminApi(user, req, pathname){
  const role = roleOf(user);
  if(!isDashboardAccount(user)) return false;
  if(role === 'admin' || role === 'administrator') return true;
  const mutating = MUTATING_METHODS.has(req.method);
  if(role === 'viewer') return !mutating && !pathname.startsWith('/api/accounts') && !pathname.startsWith('/api/backups') && pathname !== '/api/audit';
  if(role === 'editor'){
    if(pathname.startsWith('/api/accounts') || pathname.startsWith('/api/backups') || pathname === '/api/security/status' || pathname === '/api/audit') return !mutating && pathname === '/api/security/status';
    if(!mutating) return true;
    return pathname === '/content' || pathname === '/api/content' ||
      pathname.startsWith('/api/alerts') || pathname.startsWith('/api/campaigns') ||
      pathname.startsWith('/api/elections') || pathname.startsWith('/api/requests/status');
  }
  return false;
}
function sanitizeStringValue(s){
  return String(s)
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '');
}
function sanitizeDeep(value, depth=0){
  if(depth > 20) return value;
  if(typeof value === 'string') return sanitizeStringValue(value);
  if(Array.isArray(value)) return value.map(v => sanitizeDeep(v, depth+1));
  if(value && typeof value === 'object'){
    const out = {};
    for(const [k,v] of Object.entries(value)) out[k] = sanitizeDeep(v, depth+1);
    return out;
  }
  return value;
}

function readJsonMaybe(file, fallback){
  try{
    if(!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    if(!raw || !raw.trim()) return fallback;
    return safeParse(raw, fallback);
  }catch(e){
    return fallback;
  }
}
function isPlainObject(v){
  return v && typeof v === 'object' && !Array.isArray(v);
}
function contentListTotal(content){
  if(!isPlainObject(content)) return 0;
  return PUBLIC_CONTENT_LIST_KEYS.reduce((n,k)=>n + (Array.isArray(content[k]) ? content[k].length : 0), 0);
}
function repairPublicContent(content, shouldWrite){
  const live = isPlainObject(content) ? content : {};
  const bundled = readJsonMaybe(BUNDLED_CONTENT_FILE, null);
  if(!isPlainObject(bundled)) return live;

  let changed = false;

  // If the live file is empty/broken, rebuild missing public/dashboard support beams
  // from the bundled example content. This keeps users/sessions/requests/votes
  // in the runtime DB untouched because those are not stored in site-data.json.
  for(const k of PUBLIC_CONTENT_LIST_KEYS){
    if(!Array.isArray(live[k]) || live[k].length === 0){
      if(Array.isArray(bundled[k])){
        live[k] = bundled[k];
        changed = true;
      }
    }
  }

  for(const k of PUBLIC_CONTENT_OBJECT_KEYS){
    if(!isPlainObject(live[k]) || Object.keys(live[k]).length === 0){
      if(isPlainObject(bundled[k])){
        live[k] = bundled[k];
        changed = true;
      }
    }
  }

  if(!live.lastModified && bundled.lastModified){
    live.lastModified = bundled.lastModified;
    changed = true;
  }

  // Keep unknown user-created public content fields if they exist.
  if(shouldWrite && changed){
    try{
      fs.mkdirSync(path.dirname(DATA_FILE), {recursive:true});
      atomicWrite(DATA_FILE, JSON.stringify(live,null,2));
    }catch(e){
      console.error('Could not repair public content file:', e.message);
    }
  }

  return live;
}
function readContent(){
  const content = readJsonMaybe(DATA_FILE, {});
  const repaired = repairPublicContent(content, true);
  if(!Array.isArray(repaired.recordRegistry)) repaired.recordRegistry = [];
  return syncPublicRecordsFromRegistry(repaired);
}
function writeContent(content){
  const clean = sanitizeDeep(content);
  saveContentVersion(clean, 'content-update');
  atomicWrite(DATA_FILE, JSON.stringify(clean,null,2));
}
function normalizeAlert(a){
  const nowDate = new Date().toISOString().slice(0,10);
  const idBase = String(a.title || a.title_de || a.hazardType || 'alert').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'alert';
  return {
    id: a.id || (idBase + '-' + Date.now().toString(36)),
    hazardType: String(a.hazardType || 'general').trim(),
    severity: String(a.severity || 'advisory').trim(),
    status: String(a.status || 'draft').trim(),
    title: String(a.title || '').trim(),
    title_de: String(a.title_de || a.title || '').trim(),
    affectedArea: String(a.affectedArea || '').trim(),
    affectedArea_de: String(a.affectedArea_de || a.affectedArea || '').trim(),
    startTime: String(a.startTime || '').trim(),
    endTime: String(a.endTime || '').trim(),
    date: String(a.date || nowDate).trim(),
    message: String(a.message || '').trim(),
    message_de: String(a.message_de || a.message || '').trim(),
    instructions: String(a.instructions || '').trim(),
    instructions_de: String(a.instructions_de || a.instructions || '').trim(),
    linkTitle: String(a.linkTitle || '').trim(),
    linkTitle_de: String(a.linkTitle_de || a.linkTitle || '').trim(),
    linkUrl: String(a.linkUrl || '').trim(),
    attachmentTitle: String(a.attachmentTitle || '').trim(),
    attachmentTitle_de: String(a.attachmentTitle_de || a.attachmentTitle || '').trim(),
    attachmentUrl: String(a.attachmentUrl || '').trim(),
    publishStatus: String(a.publishStatus || (String(a.status || '') === 'active' ? 'published' : 'draft')).trim()
  };
}
function normalizeAlertSettings(x){
  return {
    enabled: !!(x && x.enabled),
    bannerEnabled: x && x.bannerEnabled !== false,
    publicListEnabled: x && x.publicListEnabled !== false,
    message: String((x && x.message) || 'Emergency Alert System is currently not active.'),
    message_de: String((x && x.message_de) || 'Das Notfallmeldesystem ist derzeit nicht aktiv.')
  };
}

function normalizeCampaignSettings(x){
  return {
    enabled: !!(x && x.enabled),
    homepageEnabled: x && x.homepageEnabled !== false,
    publicListEnabled: x && x.publicListEnabled !== false,
    label: String((x && x.label) || 'Promoted public notice'),
    label_de: String((x && x.label_de) || 'Hervorgehobene öffentliche Mitteilung'),
    inactiveMessage: String((x && x.inactiveMessage) || 'Official campaigns are currently not active.'),
    inactiveMessage_de: String((x && x.inactiveMessage_de) || 'Offizielle Kampagnen sind derzeit nicht aktiv.')
  };
}
function normalizeCampaign(c){
  const idBase = String(c.title || c.title_de || c.campaignType || 'campaign').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'campaign';
  const status = String(c.status || 'draft').trim();
  return {
    id: c.id || (idBase + '-' + Date.now().toString(36)),
    campaignType: String(c.campaignType || 'public-service').trim(),
    status,
    priority: Number(c.priority || 0),
    sponsor: String(c.sponsor || '').trim(),
    sponsor_de: String(c.sponsor_de || c.sponsor || '').trim(),
    disclosure: String(c.disclosure || 'Promoted public notice').trim(),
    disclosure_de: String(c.disclosure_de || c.disclosure || 'Hervorgehobene öffentliche Mitteilung').trim(),
    placement: String(c.placement || 'homepage').trim(),
    title: String(c.title || '').trim(),
    title_de: String(c.title_de || c.title || '').trim(),
    summary: String(c.summary || '').trim(),
    summary_de: String(c.summary_de || c.summary || '').trim(),
    imageUrl: String(c.imageUrl || '').trim(),
    linkTitle: String(c.linkTitle || '').trim(),
    linkTitle_de: String(c.linkTitle_de || c.linkTitle || '').trim(),
    linkUrl: String(c.linkUrl || '').trim(),
    startDate: String(c.startDate || '').trim(),
    endDate: String(c.endDate || '').trim(),
    publishStatus: String(c.publishStatus || (status === 'active' ? 'published' : 'draft')).trim()
  };
}
function activePublicCampaigns(campaigns){
  const today = new Date().toISOString().slice(0,10);
  return (Array.isArray(campaigns)?campaigns:[]).filter(c => {
    if(c.publishStatus && c.publishStatus !== 'published') return false;
    if(String(c.status||'').toLowerCase() !== 'active') return false;
    if(c.startDate && c.startDate > today) return false;
    if(c.endDate && c.endDate < today) return false;
    return true;
  }).sort((a,b)=>Number(b.priority||0)-Number(a.priority||0));
}

function activePublicAlerts(alerts){
  const now = Date.now();
  return (Array.isArray(alerts)?alerts:[]).filter(a => {
    if(a.publishStatus && a.publishStatus !== 'published') return false;
    if(!['active','watch','advisory','emergency','critical'].includes(String(a.status||'').toLowerCase())) return false;
    if(a.endTime && Date.parse(a.endTime) && Date.parse(a.endTime) < now) return false;
    return true;
  });
}



function normalizeVotingSettings(x){
  return {
    enabled: !!(x && x.enabled),
    publicVotingPageEnabled: x && x.publicVotingPageEnabled !== false,
    resultsPageEnabled: x && x.resultsPageEnabled !== false,
    inactiveMessage: String((x && x.inactiveMessage) || 'Online voting is currently not active.'),
    inactiveMessage_de: String((x && x.inactiveMessage_de) || 'Die Online-Abstimmung ist derzeit nicht aktiv.'),
    receiptPrefix: String((x && x.receiptPrefix) || 'VOTE').replace(/[^A-Z0-9_-]/gi,'').toUpperCase() || 'VOTE'
  };
}
function normalizeElection(e){
  const idBase = String(e.title || e.title_de || e.electionType || 'election').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'election';
  const status = String(e.status || 'draft').trim();
  const candidates = Array.isArray(e.candidates) ? e.candidates.map(c => {
    const cid = String(c.id || c.name || '').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'');
    return {
      id: cid || ('candidate-' + crypto.randomBytes(3).toString('hex')),
      name: String(c.name || c.id || '').trim(),
      name_de: String(c.name_de || c.name || c.id || '').trim(),
      summary: String(c.summary || '').trim(),
      summary_de: String(c.summary_de || c.summary || '').trim()
    };
  }) : [];
  return {
    id: e.id || (idBase + '-' + Date.now().toString(36)),
    electionType: String(e.electionType || 'general').trim(),
    status,
    title: String(e.title || '').trim(),
    title_de: String(e.title_de || e.title || '').trim(),
    description: String(e.description || '').trim(),
    description_de: String(e.description_de || e.description || '').trim(),
    startDate: String(e.startDate || '').trim(),
    endDate: String(e.endDate || '').trim(),
    allowRevote: !!e.allowRevote,
    showLiveResults: !!e.showLiveResults,
    publishFinalResults: !!e.publishFinalResults,
    publishStatus: String(e.publishStatus || (['open','closed','certified'].includes(status) ? 'published' : 'draft')).trim(),
    candidates
  };
}
function visiblePublicElections(elections){
  const today = new Date().toISOString().slice(0,10);
  return (Array.isArray(elections)?elections:[]).filter(e => {
    if(e.publishStatus && e.publishStatus !== 'published') return false;
    const st = String(e.status || '').toLowerCase();
    if(!['open','closed','certified'].includes(st)) return false;
    if(e.startDate && e.startDate > today && st === 'open') return false;
    if(e.endDate && e.endDate < today && st === 'open') return false;
    return true;
  });
}
function canShowElectionResults(e){
  const st = String(e.status || '').toLowerCase();
  return !!(e.showLiveResults || e.publishFinalResults || st === 'closed' || st === 'certified');
}
function voteReceipt(prefix){
  return String(prefix || 'VOTE').toUpperCase() + '-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}
function getVotes(){
  if(dbMode === 'sqlite'){
    return DB.prepare('SELECT id, receipt, electionId, candidateId, userId, username, createdAt, payload FROM election_votes ORDER BY createdAt DESC').all()
      .map(v => ({...safeParse(v.payload || '{}', {}), ...v}));
  }
  initJsonFiles();
  return readJsonFile(VOTES_FILE, []);
}
function votesForElection(electionId){
  return getVotes().filter(v => v.electionId === electionId);
}
function getUserVote(electionId, userId){
  return getVotes().find(v => v.electionId === electionId && v.userId === userId);
}
function countVotes(election){
  const counts = {};
  for(const c of (election.candidates || [])) counts[c.id] = 0;
  for(const v of votesForElection(election.id)){
    if(Object.prototype.hasOwnProperty.call(counts, v.candidateId)) counts[v.candidateId]++;
  }
  return counts;
}
function insertOrUpdateVote(v, allowRevote){
  if(dbMode === 'sqlite'){
    if(allowRevote){
      DB.prepare('DELETE FROM election_votes WHERE electionId = ? AND userId = ?').run(v.electionId, v.userId);
    }
    DB.prepare('INSERT INTO election_votes (id, receipt, electionId, candidateId, userId, username, createdAt, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(v.id, v.receipt, v.electionId, v.candidateId, v.userId, v.username || '', v.createdAt, JSON.stringify(v));
    return;
  }
  const votes = getVotes();
  const existing = votes.findIndex(x => x.electionId === v.electionId && x.userId === v.userId);
  if(existing >= 0 && allowRevote) votes.splice(existing, 1);
  votes.push(v);
  writeJsonFile(VOTES_FILE, votes);
}
function publicElectionPayload(e, userVote){
  const counts = canShowElectionResults(e) ? countVotes(e) : null;
  return {
    ...e,
    userVote: userVote ? {receipt:userVote.receipt, candidateId:userVote.candidateId, createdAt:userVote.createdAt} : null,
    resultsVisible: !!counts,
    results: counts
  };
}


let DB = null;
let dbMode = 'json';

function tryInitSqlite(){
  if(process.env.DB_MODE === 'json') return false;
  try{
    const sqlite = require('node:sqlite');
    const DatabaseSync = sqlite.DatabaseSync;
    ensureDir();
    DB = new DatabaseSync(DB_FILE);
    DB.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        displayName TEXT NOT NULL,
        accountType TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        passwordHash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        reference TEXT UNIQUE NOT NULL,
        requestType TEXT,
        fullName TEXT,
        email TEXT,
        location TEXT,
        details TEXT,
        status TEXT,
        decisionNote TEXT,
        decidedAt TEXT,
        createdAt TEXT,
        payload TEXT
      );
      CREATE TABLE IF NOT EXISTS content_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        createdAt TEXT NOT NULL,
        label TEXT,
        content TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        createdAt TEXT NOT NULL,
        actor TEXT,
        action TEXT NOT NULL,
        target TEXT,
        details TEXT,
        ip TEXT
      );
      CREATE TABLE IF NOT EXISTS election_votes (
        id TEXT PRIMARY KEY,
        receipt TEXT UNIQUE NOT NULL,
        electionId TEXT NOT NULL,
        candidateId TEXT NOT NULL,
        userId TEXT NOT NULL,
        username TEXT,
        createdAt TEXT NOT NULL,
        payload TEXT,
        UNIQUE(electionId, userId)
      );
    `);
    // Migration for older DBs without new columns.
    const cols = DB.prepare(`PRAGMA table_info(requests)`).all().map(c=>c.name);
    if(!cols.includes('decisionNote')) DB.exec(`ALTER TABLE requests ADD COLUMN decisionNote TEXT`);
    if(!cols.includes('decidedAt')) DB.exec(`ALTER TABLE requests ADD COLUMN decidedAt TEXT`);
    const cvCols = DB.prepare(`PRAGMA table_info(content_versions)`).all().map(c=>c.name);
    if(!cvCols.includes('label')) DB.exec(`ALTER TABLE content_versions ADD COLUMN label TEXT`);
    dbMode = 'sqlite';
    migrateSqliteSecurityColumns();
    migrateJsonToSqlite();
    return true;
  }catch(e){
    console.warn('SQLite unavailable, falling back to JSON:', e.message);
    DB = null;
    dbMode = 'json';
    return false;
  }
}

function migrateJsonToSqlite(){
  if(!DB) return;
  const count = DB.prepare('SELECT COUNT(*) AS c FROM accounts').get().c;
  if(count === 0 && fs.existsSync(USERS_FILE)){
    const users = readJsonFile(USERS_FILE, []);
    const stmt = DB.prepare('INSERT OR IGNORE INTO accounts (id, username, email, displayName, accountType, createdAt, passwordHash) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for(const u of users){
      if(u.username && (u.passwordHash || u.password_hash)){
        stmt.run(u.id || crypto.randomUUID(), u.username, u.email || '', u.displayName || u.username, u.accountType || 'citizen', u.createdAt || new Date().toISOString(), u.passwordHash || u.password_hash);
      }
    }
  }
  const rcount = DB.prepare('SELECT COUNT(*) AS c FROM requests').get().c;
  if(rcount === 0 && fs.existsSync(REQUESTS_FILE)){
    const requests = readJsonFile(REQUESTS_FILE, []);
    const stmt = DB.prepare('INSERT OR IGNORE INTO requests (id, reference, requestType, fullName, email, location, details, status, decisionNote, decidedAt, createdAt, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for(const r of requests){
      const reference = r.reference || makeRef(r.requestType === 'report' ? 'MID' : 'TAP');
      stmt.run(r.id || crypto.randomUUID(), reference, r.requestType || '', r.fullName || '', r.email || '', r.location || '', r.details || '', r.status || 'Submitted', r.decisionNote || '', r.decidedAt || '', r.createdAt || new Date().toISOString(), JSON.stringify(r));
    }
  }
}

function audit(action, target='', details={}, req=null, actor='system'){
  try{
    const entry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      actor, action, target, details,
      ip: req ? getIp(req) : ''
    };
    if(dbMode === 'sqlite'){
      DB.prepare('INSERT INTO audit_logs (createdAt, actor, action, target, details, ip) VALUES (?, ?, ?, ?, ?, ?)')
        .run(entry.createdAt, entry.actor, entry.action, entry.target, JSON.stringify(entry.details || {}), entry.ip);
    }else{
      const logs = readJsonFile(AUDIT_FILE, []);
      logs.push(entry);
      writeJsonFile(AUDIT_FILE, logs.slice(-1500));
    }
  }catch(e){ console.warn('Audit log failed:', e.message); }
}
function getAuditLogs(){
  if(dbMode === 'sqlite'){
    return DB.prepare('SELECT id, createdAt, actor, action, target, details, ip FROM audit_logs ORDER BY id DESC LIMIT 700').all()
      .map(r => ({...r, details: safeParse(r.details, {})}));
  }
  return readJsonFile(AUDIT_FILE, []).slice(-700).reverse();
}

function getAccounts(){
  if(dbMode === 'sqlite'){
    return DB.prepare('SELECT id, username, email, displayName, accountType, createdAt, passwordHash, mustChangePassword, failedLoginCount, lockedUntil, lastLoginAt, mfaSecret, mfaEnabled FROM accounts ORDER BY createdAt DESC').all();
  }
  initJsonFiles();
  return readJsonFile(USERS_FILE, []);
}
function getAccountById(id){ return getAccounts().find(u => u.id === id); }
function getSessionByToken(token){
  if(!token) return null;
  if(dbMode === 'sqlite'){
    const s = DB.prepare('SELECT token, userId, createdAt, csrfToken, expiresAt, purpose FROM sessions WHERE token = ?').get(token);
    if(!s) return null;
    if(s.expiresAt && isExpiredIso(s.expiresAt)){ deleteSession(token); return null; }
    return s;
  }
  const sessions = readJsonFile(SESSIONS_FILE, []);
  const s = sessions.find(x => x.token === token);
  if(!s) return null;
  if(s.expiresAt && isExpiredIso(s.expiresAt)){ deleteSession(token); return null; }
  return s;
}
function getAccountByToken(token){
  const s = getSessionByToken(token);
  return s ? getAccountById(s.userId) : null;
}
function insertAccount(u){
  const account = {
    mustChangePassword: 0,
    failedLoginCount: 0,
    lockedUntil: '',
    lastLoginAt: '',
    mfaSecret: '',
    mfaEnabled: 0,
    ...u
  };
  if(dbMode === 'sqlite'){
    DB.prepare('INSERT INTO accounts (id, username, email, displayName, accountType, createdAt, passwordHash, mustChangePassword, failedLoginCount, lockedUntil, lastLoginAt, mfaSecret, mfaEnabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(account.id, account.username, account.email, account.displayName, account.accountType, account.createdAt, account.passwordHash, account.mustChangePassword ? 1 : 0, account.failedLoginCount || 0, account.lockedUntil || '', account.lastLoginAt || '', account.mfaSecret || '', account.mfaEnabled ? 1 : 0);
    return;
  }
  const users = getAccounts();
  users.push(account);
  writeJsonFile(USERS_FILE, users);
}
function getRequests(){
  if(dbMode === 'sqlite'){
    return DB.prepare('SELECT id, reference, requestType, fullName, email, location, details, status, decisionNote, decidedAt, createdAt, payload FROM requests ORDER BY createdAt DESC').all()
      .map(r => ({...safeParse(r.payload || '{}', {}), ...r}));
  }
  initJsonFiles();
  return readJsonFile(REQUESTS_FILE, []);
}
function saveRequestsJson(requests){ writeJsonFile(REQUESTS_FILE, requests); }
function insertRequest(r){
  if(dbMode === 'sqlite'){
    DB.prepare('INSERT INTO requests (id, reference, requestType, fullName, email, location, details, status, decisionNote, decidedAt, createdAt, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(r.id, r.reference, r.requestType || '', r.fullName || '', r.email || '', r.location || '', r.details || '', r.status || 'Submitted', r.decisionNote || '', r.decidedAt || '', r.createdAt, JSON.stringify(r));
    return;
  }
  const requests = getRequests();
  requests.push(r);
  writeJsonFile(REQUESTS_FILE, requests);
}
function updateRequestStatus(reference, status, note){
  const decidedAt = new Date().toISOString();
  if(dbMode === 'sqlite'){
    const row = DB.prepare('SELECT payload FROM requests WHERE reference = ?').get(reference);
    if(!row) return null;
    const old = safeParse(row.payload || '{}', {});
    const next = {...old, reference, status, decisionNote: note || '', decidedAt};
    DB.prepare('UPDATE requests SET status = ?, decisionNote = ?, decidedAt = ?, payload = ? WHERE reference = ?')
      .run(status, note || '', decidedAt, JSON.stringify(next), reference);
    return next;
  }
  const requests = getRequests();
  const idx = requests.findIndex(r => r.reference === reference);
  if(idx < 0) return null;
  requests[idx] = {...requests[idx], status, decisionNote: note || '', decidedAt};
  saveRequestsJson(requests);
  return requests[idx];
}
function insertSession(s){
  const session = {
    csrfToken: '',
    expiresAt: '',
    purpose: '',
    ...s
  };
  if(dbMode === 'sqlite'){
    DB.prepare('INSERT INTO sessions (token, userId, createdAt, csrfToken, expiresAt, purpose) VALUES (?, ?, ?, ?, ?, ?)')
      .run(session.token, session.userId, session.createdAt, session.csrfToken || '', session.expiresAt || '', session.purpose || '');
    return;
  }
  const sessions = readJsonFile(SESSIONS_FILE, []);
  sessions.push(session);
  writeJsonFile(SESSIONS_FILE, sessions);
}
function deleteSession(token){
  if(!token) return;
  if(dbMode === 'sqlite'){
    DB.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return;
  }
  const sessions = readJsonFile(SESSIONS_FILE, []).filter(s => s.token !== token);
  writeJsonFile(SESSIONS_FILE, sessions);
}
function updateAccountType(userId, accountType){
  if(dbMode === 'sqlite'){
    DB.prepare('UPDATE accounts SET accountType = ? WHERE id = ?').run(accountType, userId);
    return;
  }
  const users = getAccounts();
  const idx = users.findIndex(u => u.id === userId);
  if(idx >= 0){
    users[idx].accountType = accountType;
    writeJsonFile(USERS_FILE, users);
  }
}
function generateInitialAdminPassword(){
  ensureDir();
  if(process.env.ADMIN_INITIAL_PASSWORD) return String(process.env.ADMIN_INITIAL_PASSWORD);
  try{
    if(fs.existsSync(ADMIN_INITIAL_PASSWORD_FILE)){
      const raw = fs.readFileSync(ADMIN_INITIAL_PASSWORD_FILE, 'utf8');
      const m = raw.match(/password:\s*(.+)/i);
      if(m && m[1].trim()) return m[1].trim();
    }
  }catch(e){}
  const password = crypto.randomBytes(18).toString('base64url');
  const text = [
    'Separated Kingdom dashboard bootstrap admin',
    'username: admin',
    'password: ' + password,
    'created: ' + new Date().toISOString(),
    '',
    'Delete this file after saving the password in a secure password manager.'
  ].join('\n');
  try{
    fs.writeFileSync(ADMIN_INITIAL_PASSWORD_FILE, text, {encoding:'utf8', mode:0o600});
  }catch(e){
    console.warn('Could not write initial admin password file:', e.message);
  }
  return password;
}
function ensureBootstrapAdmin(){
  const accounts = getAccounts();
  const existingAdminUser = accounts.find(u => String(u.username || '').toLowerCase() === 'admin');
  const anyDashboardAccount = accounts.some(isDashboardAccount);
  if(existingAdminUser){
    if(!isDashboardAccount(existingAdminUser) && !anyDashboardAccount){
      updateAccountType(existingAdminUser.id, 'admin');
      audit('bootstrap_admin_promoted', 'admin', {}, null, 'system');
    }
    return;
  }
  if(anyDashboardAccount) return;
  const password = generateInitialAdminPassword();
  const u = {
    id: crypto.randomUUID(),
    username: 'admin',
    email: process.env.ADMIN_INITIAL_EMAIL || 'admin@example.local',
    displayName: 'System Administrator',
    accountType: 'admin',
    createdAt: new Date().toISOString(),
    mustChangePassword: 1,
    passwordHash: hashPassword(password)
  };
  insertAccount(u);
  audit('bootstrap_admin_created', 'admin', {passwordFile: ADMIN_INITIAL_PASSWORD_FILE}, null, 'system');
}
function saveContentVersion(content, label='auto-save'){
  if(dbMode === 'sqlite'){
    DB.prepare('INSERT INTO content_versions (createdAt, label, content) VALUES (?, ?, ?)').run(new Date().toISOString(), label, JSON.stringify(content));
  }
}
function listContentVersions(){
  if(dbMode === 'sqlite'){
    return DB.prepare('SELECT id, createdAt, label, length(content) AS bytes FROM content_versions ORDER BY id DESC LIMIT 100').all();
  }
  return [];
}
function getContentVersion(id){
  if(dbMode !== 'sqlite') return null;
  const row = DB.prepare('SELECT id, createdAt, label, content FROM content_versions WHERE id = ?').get(id);
  return row ? {...row, content:safeParse(row.content, null)} : null;
}

function slugCase(s){
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}
function generateCaseNumber(accessLevel){
  const year = new Date().getFullYear();
  const prefix = accessLevel === 'private' ? 'PRV' : (accessLevel === 'restricted' ? 'RST' : 'PUB');
  return `${prefix}-${year}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
function normalizeRecordEntry(input, existing){
  const nowDate = new Date().toISOString().slice(0,10);
  const accessLevel = ['public','private','restricted'].includes(String(input.accessLevel || '').toLowerCase())
    ? String(input.accessLevel).toLowerCase()
    : 'public';
  const record = {
    ...(existing || {}),
    id: existing && existing.id ? existing.id : (input.id || crypto.randomUUID()),
    caseNumber: String(input.caseNumber || (existing && existing.caseNumber) || generateCaseNumber(accessLevel)).trim().toUpperCase(),
    accessLevel,
    publishStatus: String(input.publishStatus || (accessLevel === 'public' ? 'published' : 'draft')).trim(),
    date: String(input.date || (existing && existing.date) || nowDate).trim(),
    title: String(input.title || '').trim(),
    title_de: String(input.title_de || input.title || '').trim(),
    status: String(input.status || 'Active').trim(),
    status_de: String(input.status_de || input.status || 'Aktiv').trim(),
    summary: String(input.summary || '').trim(),
    summary_de: String(input.summary_de || input.summary || '').trim(),
    department: String(input.department || '').trim(),
    department_de: String(input.department_de || input.department || '').trim(),
    requesterName: String(input.requesterName || '').trim(),
    requesterEmail: String(input.requesterEmail || '').trim().toLowerCase(),
    recordTag: String(input.recordTag || input.caseNumber || '').trim(),
    decisionNote: String(input.decisionNote || '').trim(),
    decisionNote_de: String(input.decisionNote_de || input.decisionNote || '').trim(),
    url: String(input.url || '').trim(),
    url_de: String(input.url_de || (String(input.url || '').startsWith('/en/') ? String(input.url || '').replace('/en/','/de/') : String(input.url || ''))).trim(),
    attachmentTitle: String(input.attachmentTitle || '').trim(),
    attachmentTitle_de: String(input.attachmentTitle_de || input.attachmentTitle || '').trim(),
    attachmentUrl: String(input.attachmentUrl || '').trim(),
    createdAt: existing && existing.createdAt ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if(!record.title) record.title = record.caseNumber;
  if(!record.title_de) record.title_de = record.title;
  if(!record.summary) record.summary = record.decisionNote || 'Record registry entry.';
  if(!record.summary_de) record.summary_de = record.summary;
  return record;
}
function getRecordRegistry(content){
  const c = content || readContent();
  if(!Array.isArray(c.recordRegistry)) c.recordRegistry = [];
  return c.recordRegistry;
}
function publicRecordFromRegistry(record){
  return {
    id: record.id || record.caseNumber,
    caseNumber: record.caseNumber,
    accessLevel: 'public',
    recordTag: record.recordTag || record.caseNumber,
    title: record.title,
    title_de: record.title_de || record.title,
    status: record.status || 'Published',
    status_de: record.status_de || record.status || 'Veröffentlicht',
    summary: record.summary,
    summary_de: record.summary_de || record.summary,
    date: record.date || '',
    url: record.url || '',
    url_de: record.url_de || '',
    linkTitle: record.linkTitle || '',
    linkTitle_de: record.linkTitle_de || record.linkTitle || '',
    linkUrl: record.linkUrl || '',
    attachmentTitle: record.attachmentTitle || '',
    attachmentTitle_de: record.attachmentTitle_de || record.attachmentTitle || '',
    attachmentUrl: record.attachmentUrl || '',
    publishStatus: record.publishStatus || 'published'
  };
}
function syncPublicRecordsFromRegistry(content){
  if(!content || typeof content !== 'object') return content;
  if(!Array.isArray(content.records)) content.records = [];
  if(!Array.isArray(content.recordRegistry)) content.recordRegistry = [];

  const registryIds = new Set(content.recordRegistry.map(r => r.id || r.caseNumber).filter(Boolean));
  content.records = content.records.filter(r => !(r && r.registryManaged && registryIds.has(r.registryId || r.id || r.caseNumber)));

  for(const record of content.recordRegistry){
    if(record.accessLevel === 'public' && record.publishStatus === 'published'){
      content.records.push({
        ...publicRecordFromRegistry(record),
        registryManaged: true,
        registryId: record.id || record.caseNumber
      });
    }
  }
  return content;
}
function safePublicRegistryRecord(record, email){
  if(!record) return null;
  const accessLevel = String(record.accessLevel || 'public').toLowerCase();
  const requesterEmail = String(record.requesterEmail || '').toLowerCase();
  const emailOk = email && requesterEmail && requesterEmail === String(email).toLowerCase();
  if(accessLevel !== 'public' && !emailOk) return null;
  return {
    caseNumber: record.caseNumber,
    accessLevel,
    title: record.title || '',
    title_de: record.title_de || record.title || '',
    status: record.status || '',
    status_de: record.status_de || record.status || '',
    summary: accessLevel === 'public' ? (record.summary || '') : '',
    decisionNote: record.decisionNote || '',
    decisionNote_de: record.decisionNote_de || record.decisionNote || '',
    recordTag: record.recordTag || '',
    date: record.date || '',
    department: record.department || '',
    department_de: record.department_de || record.department || '',
    updatedAt: record.updatedAt || '',
    attachmentTitle: accessLevel === 'public' || emailOk ? (record.attachmentTitle || '') : '',
    attachmentTitle_de: accessLevel === 'public' || emailOk ? (record.attachmentTitle_de || record.attachmentTitle || '') : '',
    attachmentUrl: accessLevel === 'public' || emailOk ? (record.attachmentUrl || '') : ''
  };
}
function upsertRecordRegistry(input){
  const content = readContent();
  if(!Array.isArray(content.recordRegistry)) content.recordRegistry = [];
  const caseNumber = String(input.caseNumber || '').trim().toUpperCase();
  const id = String(input.id || '').trim();
  const idx = content.recordRegistry.findIndex(r =>
    (id && r.id === id) || (caseNumber && String(r.caseNumber || '').toUpperCase() === caseNumber)
  );
  const existing = idx >= 0 ? content.recordRegistry[idx] : null;
  const record = normalizeRecordEntry(input, existing);
  if(content.recordRegistry.some(r => r !== existing && String(r.caseNumber || '').toUpperCase() === record.caseNumber)){
    const err = new Error('Case number already exists');
    err.statusCode = 409;
    throw err;
  }
  if(idx >= 0) content.recordRegistry[idx] = record;
  else content.recordRegistry.unshift(record);
  syncPublicRecordsFromRegistry(content);
  writeContent(content);
  return record;
}
function deleteRecordRegistry(idOrCase){
  const content = readContent();
  if(!Array.isArray(content.recordRegistry)) content.recordRegistry = [];
  const key = String(idOrCase || '').trim().toUpperCase();
  const before = content.recordRegistry.length;
  content.recordRegistry = content.recordRegistry.filter(r =>
    String(r.id || '').toUpperCase() !== key && String(r.caseNumber || '').toUpperCase() !== key
  );
  syncPublicRecordsFromRegistry(content);
  writeContent(content);
  return before !== content.recordRegistry.length;
}

function requestPublicTypeLabel(type, accessType){
  if(type === 'report') return 'Infrastructure report';
  if(type === 'permit') return 'Transit access permit';
  if(type === 'records'){
    if(accessType === 'private') return 'Private record request';
    return 'Public record request';
  }
  return type || 'Request';
}
function safePublicRequest(r){
  if(!r) return null;
  return {
    reference: r.reference,
    requestType: r.requestType || '',
    requestLabel: requestPublicTypeLabel(r.requestType, r.recordAccessType),
    recordAccessType: r.recordAccessType || '',
    recordTag: r.recordTag || r.caseNumber || '',
    location: r.location || '',
    status: r.status || 'Submitted',
    decisionNote: r.decisionNote || '',
    decidedAt: r.decidedAt || '',
    createdAt: r.createdAt || ''
  };
}

function createAccount(req, res, j, actor='admin'){
  if(!j || !j.username || !j.password || !j.email) return json(res,400,{error:'Missing required fields'});
  const users = getAccounts();
  if(users.some(u => u.username === j.username)) return json(res,409,{error:'Username already exists'});
  const u = {
    id: crypto.randomUUID(),
    username: String(j.username).trim(),
    email: String(j.email).trim(),
    displayName: String(j.displayName || j.username).trim(),
    accountType: String(j.accountType || 'citizen').trim(),
    createdAt: new Date().toISOString(),
    mustChangePassword: 1,
    passwordHash: hashPassword(j.password)
  };
  insertAccount(u);
  audit('account_created', u.username, {accountType:u.accountType,email:u.email}, req, actor);
  json(res,200,{ok:true,user:safeUser(u),dbMode});
}

ensureDir();
initJsonFiles();
tryInitSqlite();
ensureBootstrapAdmin();

http.createServer((req,res)=>{
  if(req.method === 'OPTIONS') return send(res,204,'text/plain','');
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if(req.method === 'GET' && (pathname === '/health' || pathname === '/api/health')){
    return json(res,200,{ok:true,dbMode});
  }

  if(req.method === 'POST' && pathname === '/admin-auth/login'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      const username = String((j && j.username) || '').trim();
      const password = String((j && j.password) || '');
      const mfaCode = String((j && j.mfaCode) || '').trim();
      if(!rateLimitLogin(req, username)){
        audit('admin_login_rate_limited', username, {}, req, 'dashboard');
        return json(res,429,{ok:false,error:'Too many login attempts. Try again later.'});
      }
      const u = getAccounts().find(x => String(x.username || '').toLowerCase() === username.toLowerCase());
      if(u && isLocked(u)){
        audit('admin_login_locked', username, {lockedUntil:u.lockedUntil}, req, 'dashboard');
        return json(res,423,{ok:false,error:'Account is temporarily locked. Try again later.', lockedUntil:u.lockedUntil});
      }
      if(!u || !verifyPassword(password, u.passwordHash || u.password_hash) || !isDashboardAccount(u)){
        if(u) recordLoginFailure(u);
        audit('admin_login_failed', username, {}, req, 'dashboard');
        return json(res,401,{ok:false,error:'Invalid dashboard username or password'});
      }
      if(u.mfaEnabled && u.mfaSecret && !verifyTotp(u.mfaSecret, mfaCode)){
        audit('admin_login_mfa_required', u.username, {}, req, 'dashboard');
        return json(res,401,{ok:false,mfaRequired:true,error:'Two-factor code required'});
      }
      recordLoginSuccess(u);
      resetRateLimit(req, username);
      const token = crypto.randomBytes(32).toString('hex');
      const csrfToken = crypto.randomBytes(32).toString('hex');
      insertSession({token, userId:u.id, createdAt:new Date().toISOString(), csrfToken, expiresAt: isoPlusSeconds(ADMIN_SESSION_MAX_AGE_SECONDS), purpose:'dashboard'});
      audit('admin_login_success', u.username, {accountType:u.accountType}, req, u.username);
      return json(res,200,{ok:true,user:safeUser(u),csrfToken,dbMode}, {'Set-Cookie': adminCookie(token, req)});
    });
  }

  if(req.method === 'GET' && pathname === '/admin-auth/check'){
    const user = getAdminUser(req);
    if(user){
      const original = String(req.headers['x-forwarded-uri'] || '');
      if(user.mustChangePassword && original && !original.includes('/dashboard/change-password') && !original.includes('/dashboard/de/change-password') && !original.startsWith('/api/')){
        const next = encodeURIComponent(original || '/dashboard/');
        const dest = original.startsWith('/dashboard/de/') ? '/dashboard/de/change-password/?next=' + next : '/dashboard/change-password/?next=' + next;
        return send(res,302,'text/plain','Password change required.', {'Location':dest});
      }
      return send(res,204,'text/plain','',{
        'X-Admin-User': user.username,
        'X-Admin-Role': user.accountType || ''
      });
    }
    const original = String(req.headers['x-forwarded-uri'] || '');
    if(original && !original.startsWith('/api/')){
      const next = encodeURIComponent(original || '/dashboard/');
      return send(res,302,'text/plain','Redirecting to dashboard login.', {'Location':'/dashboard/login/?next=' + next});
    }
    return json(res,401,{ok:false,error:'Dashboard sign-in required'});
  }

  if(req.method === 'GET' && pathname === '/admin-auth/me'){
    const token = parseCookies(req)[ADMIN_COOKIE_NAME] || authToken(req);
    const session = getSessionByToken(token);
    const user = session ? getAccountById(session.userId) : null;
    if(!isDashboardAccount(user)) return json(res,401,{ok:false,error:'Dashboard sign-in required'});
    return json(res,200,{ok:true,user:safeUser(user),csrfToken:session.csrfToken || '',dbMode});
  }

  if(req.method === 'POST' && pathname === '/admin-auth/change-password'){
    const token = parseCookies(req)[ADMIN_COOKIE_NAME] || authToken(req);
    const session = getSessionByToken(token);
    const user = session ? getAccountById(session.userId) : null;
    if(!isDashboardAccount(user)) return json(res,401,{ok:false,error:'Dashboard sign-in required'});
    if(!csrfMatches(req, session)) return json(res,403,{ok:false,error:'Invalid CSRF token'});
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      const currentPassword = String((j && j.currentPassword) || '');
      const newPassword = String((j && j.newPassword) || '');
      if(!verifyPassword(currentPassword, user.passwordHash || user.password_hash)) return json(res,401,{ok:false,error:'Current password is incorrect'});
      if(newPassword.length < 12) return json(res,400,{ok:false,error:'New password must be at least 12 characters'});
      updateAccountSecurity(user.id, {passwordHash:hashPassword(newPassword), mustChangePassword:0, failedLoginCount:0, lockedUntil:''});
      audit('admin_password_changed', user.username, {}, req, user.username);
      return json(res,200,{ok:true});
    });
  }

  if(req.method === 'GET' && pathname === '/admin-auth/mfa/setup'){
    const token = parseCookies(req)[ADMIN_COOKIE_NAME] || authToken(req);
    const session = getSessionByToken(token);
    const user = session ? getAccountById(session.userId) : null;
    if(!isDashboardAccount(user)) return json(res,401,{ok:false,error:'Dashboard sign-in required'});
    const secret = user.mfaSecret || generateMfaSecret();
    if(!user.mfaSecret) updateAccountSecurity(user.id, {mfaSecret:secret, mfaEnabled:0});
    const issuer = encodeURIComponent('Separated Kingdom Dashboard');
    const label = encodeURIComponent(user.username || 'admin');
    return json(res,200,{ok:true,secret,otpauth:`otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&digits=6&period=30`});
  }

  if(req.method === 'POST' && pathname === '/admin-auth/mfa/enable'){
    const token = parseCookies(req)[ADMIN_COOKIE_NAME] || authToken(req);
    const session = getSessionByToken(token);
    const user = session ? getAccountById(session.userId) : null;
    if(!isDashboardAccount(user)) return json(res,401,{ok:false,error:'Dashboard sign-in required'});
    if(!csrfMatches(req, session)) return json(res,403,{ok:false,error:'Invalid CSRF token'});
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      const secret = user.mfaSecret || String((j && j.secret) || '');
      if(!secret || !verifyTotp(secret, j && j.code)) return json(res,400,{ok:false,error:'Invalid two-factor code'});
      updateAccountSecurity(user.id, {mfaSecret:secret, mfaEnabled:1});
      audit('admin_mfa_enabled', user.username, {}, req, user.username);
      return json(res,200,{ok:true});
    });
  }

  if(req.method === 'POST' && pathname === '/admin-auth/mfa/disable'){
    const token = parseCookies(req)[ADMIN_COOKIE_NAME] || authToken(req);
    const session = getSessionByToken(token);
    const user = session ? getAccountById(session.userId) : null;
    if(!isDashboardAccount(user)) return json(res,401,{ok:false,error:'Dashboard sign-in required'});
    if(!csrfMatches(req, session)) return json(res,403,{ok:false,error:'Invalid CSRF token'});
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      if(!verifyPassword(String((j && j.password) || ''), user.passwordHash || user.password_hash)) return json(res,401,{ok:false,error:'Password is incorrect'});
      updateAccountSecurity(user.id, {mfaSecret:'', mfaEnabled:0});
      audit('admin_mfa_disabled', user.username, {}, req, user.username);
      return json(res,200,{ok:true});
    });
  }

  if(req.method === 'POST' && pathname === '/admin-auth/logout'){
    const token = parseCookies(req)[ADMIN_COOKIE_NAME] || authToken(req);
    const user = getAccountByToken(token);
    deleteSession(token);
    if(user) audit('admin_logout', user.username, {}, req, user.username);
    return json(res,200,{ok:true}, {'Set-Cookie': clearAdminCookie(req)});
  }

  if(isAdminApiPath(pathname)){
    const token = parseCookies(req)[ADMIN_COOKIE_NAME] || authToken(req);
    const session = getSessionByToken(token);
    const adminUser = session ? getAccountById(session.userId) : null;
    if(!isDashboardAccount(adminUser)) return json(res,401,{ok:false,error:'Dashboard sign-in required'});
    if(adminUser.mustChangePassword) return json(res,403,{ok:false,mustChangePassword:true,error:'Password change required'});
    if(!canAccessAdminApi(adminUser, req, pathname)) return json(res,403,{ok:false,error:'Insufficient dashboard role'});
    if(MUTATING_METHODS.has(req.method) && !csrfMatches(req, session)) return json(res,403,{ok:false,error:'Invalid CSRF token'});
    req.adminUser = adminUser;
    req.adminSession = session;
  }

  if(req.method === 'GET' && (pathname === '/content' || pathname === '/api/content')){
    try{
      const content = readContent();
      return json(res,200,content);
    }catch(e){
      return json(res,500,{error:e.message});
    }
  }

  if(req.method === 'POST' && (pathname === '/content' || pathname === '/api/content')){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      try{
        const clean = syncPublicRecordsFromRegistry(sanitizeDeep(j));
        saveContentVersion(clean, 'dashboard-save');
        atomicWrite(DATA_FILE, JSON.stringify(clean,null,2));
        audit('content_saved', 'site-data.json', {categories:Object.keys(j || {})}, req, 'dashboard');
        json(res,200,{ok:true,dbMode});
      }catch(err){ json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'GET' && pathname === '/api/accounts'){
    audit('accounts_viewed', 'accounts', {}, req, 'dashboard');
    return json(res,200,{accounts:getAccounts().map(safeUser),dbMode});
  }

  if(req.method === 'POST' && pathname === '/api/accounts'){
    return readBody(req,(e,j)=> e ? json(res,400,{error:e.message}) : createAccount(req,res,j,'dashboard'));
  }

  if(req.method === 'GET' && pathname === '/api/record-registry'){
    try{
      const content = readContent();
      return json(res,200,{records:getRecordRegistry(content), dbMode});
    }catch(e){ return json(res,500,{error:e.message}); }
  }

  if(req.method === 'POST' && pathname === '/api/record-registry'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      try{
        const record = upsertRecordRegistry(j || {});
        audit('record_registry_saved', record.caseNumber, {accessLevel:record.accessLevel,publishStatus:record.publishStatus}, req, 'dashboard');
        return json(res,200,{ok:true,record,dbMode});
      }catch(err){ return json(res,err.statusCode || 500,{error:err.message}); }
    });
  }

  if(req.method === 'POST' && pathname === '/api/record-registry/delete'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      const key = j && (j.id || j.caseNumber);
      if(!key) return json(res,400,{error:'Missing id or caseNumber'});
      try{
        const ok = deleteRecordRegistry(key);
        if(!ok) return json(res,404,{error:'Record not found'});
        audit('record_registry_deleted', String(key), {}, req, 'dashboard');
        return json(res,200,{ok:true,dbMode});
      }catch(err){ return json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'GET' && pathname === '/api/requests'){
    audit('requests_viewed', 'requests', {}, req, 'dashboard');
    return json(res,200,{requests:getRequests(),dbMode});
  }

  if(req.method === 'POST' && pathname === '/api/requests/status'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      const allowed = ['Submitted','In review','Approved','Declined','Closed'];
      if(!j.reference || !allowed.includes(j.status)) return json(res,400,{error:'Invalid reference or status'});
      const updated = updateRequestStatus(j.reference, j.status, j.note || '');
      if(!updated) return json(res,404,{error:'Request not found'});
      audit('request_status_updated', j.reference, {status:j.status,note:j.note||''}, req, 'dashboard');
      json(res,200,{ok:true,request:updated,dbMode});
    });
  }

  if(req.method === 'GET' && pathname === '/api/audit'){
    return json(res,200,{logs:getAuditLogs(),dbMode});
  }

  if(req.method === 'GET' && pathname === '/api/security/status'){
    return json(res,200,{
      ok:true,
      dbMode,
      sqliteDatabase: DB_FILE,
      publicRegistration:false,
      publicRegistrationMessage:'Creating accounts is disabled, contact Separated Kingdom 1900-2803 hotline to register an account.',
      passwordHashing:'PBKDF2-SHA256',
      auditLog:true,
      contentVersioning:true,
      requestStatusWorkflow:true,
      caddyProtectedApi:true,
      caddyProtectedDashboard:true
    });
  }


  if(req.method === 'GET' && pathname === '/api/alerts'){
    try{
      const content = readContent();
      return json(res,200,{alerts:Array.isArray(content.alerts)?content.alerts:[], settings:normalizeAlertSettings(content.alertSettings), active:activePublicAlerts(content.alerts || []), dbMode});
    }catch(e){ return json(res,500,{error:e.message}); }
  }

  if(req.method === 'POST' && pathname === '/api/alerts/settings'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      try{
        const content = readContent();
        content.alertSettings = normalizeAlertSettings(j || {});
        writeContent(content);
        audit('alert_settings_updated', 'alertSettings', content.alertSettings, req, 'dashboard');
        return json(res,200,{ok:true,settings:content.alertSettings,dbMode});
      }catch(err){ return json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'POST' && pathname === '/api/alerts'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      try{
        const content = readContent();
        if(!Array.isArray(content.alerts)) content.alerts = [];
        const item = normalizeAlert(j);
        const idx = content.alerts.findIndex(a => a.id === item.id);
        if(idx >= 0) content.alerts[idx] = item;
        else content.alerts.push(item);
        writeContent(content);
        audit(idx >= 0 ? 'alert_updated' : 'alert_created', item.id, {severity:item.severity,status:item.status,hazardType:item.hazardType}, req, 'dashboard');
        return json(res,200,{ok:true,alert:item,dbMode});
      }catch(err){ return json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'POST' && pathname === '/api/alerts/status'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      const allowed = ['draft','active','resolved','expired'];
      if(!j.id || !allowed.includes(String(j.status||''))) return json(res,400,{error:'Invalid alert id or status'});
      try{
        const content = readContent();
        if(!Array.isArray(content.alerts)) content.alerts = [];
        const idx = content.alerts.findIndex(a => a.id === j.id);
        if(idx < 0) return json(res,404,{error:'Alert not found'});
        content.alerts[idx].status = j.status;
        content.alerts[idx].publishStatus = j.status === 'active' ? 'published' : (content.alerts[idx].publishStatus || 'draft');
        if(j.status === 'resolved' || j.status === 'expired'){
          content.alerts[idx].publishStatus = 'published';
          content.alerts[idx].endTime = content.alerts[idx].endTime || new Date().toISOString();
        }
        writeContent(content);
        audit('alert_status_updated', j.id, {status:j.status}, req, 'dashboard');
        return json(res,200,{ok:true,alert:content.alerts[idx],dbMode});
      }catch(err){ return json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'GET' && pathname === '/api/campaigns'){
    try{
      const content = readContent();
      return json(res,200,{
        campaigns:Array.isArray(content.campaigns)?content.campaigns:[],
        settings:normalizeCampaignSettings(content.campaignSettings),
        active:activePublicCampaigns(content.campaigns || []),
        dbMode
      });
    }catch(e){ return json(res,500,{error:e.message}); }
  }

  if(req.method === 'POST' && pathname === '/api/campaigns/settings'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      try{
        const content = readContent();
        content.campaignSettings = normalizeCampaignSettings(j || {});
        writeContent(content);
        audit('campaign_settings_updated', 'campaignSettings', content.campaignSettings, req, 'dashboard');
        return json(res,200,{ok:true,settings:content.campaignSettings,dbMode});
      }catch(err){ return json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'POST' && pathname === '/api/campaigns'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      try{
        const content = readContent();
        if(!Array.isArray(content.campaigns)) content.campaigns = [];
        const item = normalizeCampaign(j);
        const idx = content.campaigns.findIndex(c => c.id === item.id);
        if(idx >= 0) content.campaigns[idx] = item;
        else content.campaigns.push(item);
        writeContent(content);
        audit(idx >= 0 ? 'campaign_updated' : 'campaign_created', item.id, {campaignType:item.campaignType,status:item.status,placement:item.placement}, req, 'dashboard');
        return json(res,200,{ok:true,campaign:item,dbMode});
      }catch(err){ return json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'POST' && pathname === '/api/campaigns/status'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      const allowed = ['draft','active','paused','expired'];
      if(!j.id || !allowed.includes(String(j.status||''))) return json(res,400,{error:'Invalid campaign id or status'});
      try{
        const content = readContent();
        if(!Array.isArray(content.campaigns)) content.campaigns = [];
        const idx = content.campaigns.findIndex(c => c.id === j.id);
        if(idx < 0) return json(res,404,{error:'Campaign not found'});
        content.campaigns[idx].status = j.status;
        content.campaigns[idx].publishStatus = j.status === 'active' ? 'published' : (j.status === 'paused' ? 'published' : 'draft');
        writeContent(content);
        audit('campaign_status_updated', j.id, {status:j.status}, req, 'dashboard');
        return json(res,200,{ok:true,campaign:content.campaigns[idx],dbMode});
      }catch(err){ return json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'GET' && pathname === '/api/elections'){
    try{
      const content = readContent();
      const elections = Array.isArray(content.elections) ? content.elections : [];
      return json(res,200,{
        elections:elections.map(e => ({...e, voteCount:votesForElection(e.id).length, results:countVotes(e)})),
        settings:normalizeVotingSettings(content.votingSettings),
        dbMode
      });
    }catch(e){ return json(res,500,{error:e.message}); }
  }

  if(req.method === 'POST' && pathname === '/api/elections/settings'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      try{
        const content = readContent();
        content.votingSettings = normalizeVotingSettings(j || {});
        writeContent(content);
        audit('voting_settings_updated', 'votingSettings', content.votingSettings, req, 'dashboard');
        return json(res,200,{ok:true,settings:content.votingSettings,dbMode});
      }catch(err){ return json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'POST' && pathname === '/api/elections'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      try{
        const content = readContent();
        if(!Array.isArray(content.elections)) content.elections = [];
        const item = normalizeElection(j);
        const idx = content.elections.findIndex(x => x.id === item.id);
        if(idx >= 0) content.elections[idx] = item;
        else content.elections.push(item);
        writeContent(content);
        audit(idx >= 0 ? 'election_updated' : 'election_created', item.id, {status:item.status,candidates:item.candidates.length}, req, 'dashboard');
        return json(res,200,{ok:true,election:item,dbMode});
      }catch(err){ return json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'POST' && pathname === '/api/elections/status'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      const allowed = ['draft','open','closed','certified'];
      if(!j.id || !allowed.includes(String(j.status||''))) return json(res,400,{error:'Invalid election id or status'});
      try{
        const content = readContent();
        if(!Array.isArray(content.elections)) content.elections = [];
        const idx = content.elections.findIndex(x => x.id === j.id);
        if(idx < 0) return json(res,404,{error:'Election not found'});
        content.elections[idx].status = j.status;
        content.elections[idx].publishStatus = j.status === 'draft' ? 'draft' : 'published';
        if(j.status === 'certified') content.elections[idx].publishFinalResults = true;
        writeContent(content);
        audit('election_status_updated', j.id, {status:j.status}, req, 'dashboard');
        return json(res,200,{ok:true,election:content.elections[idx],dbMode});
      }catch(err){ return json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'GET' && pathname === '/election-api/elections'){
    try{
      const user = getAccountByToken(authToken(req));
      const content = readContent();
      const settings = normalizeVotingSettings(content.votingSettings);
      const elections = visiblePublicElections(content.elections || []).map(e => publicElectionPayload(e, user ? getUserVote(e.id, user.id) : null));
      return json(res,200,{settings,elections,authenticated:!!user,dbMode});
    }catch(e){ return json(res,500,{error:e.message}); }
  }

  if(req.method === 'POST' && pathname === '/election-api/vote'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      try{
        const user = getAccountByToken(authToken(req));
        if(!user) return json(res,401,{error:'Sign in required'});
        const content = readContent();
        const settings = normalizeVotingSettings(content.votingSettings);
        if(settings.enabled !== true) return json(res,403,{error:'Online voting is not active'});
        const election = (content.elections || []).find(x => x.id === j.electionId);
        if(!election) return json(res,404,{error:'Election not found'});
        if(election.publishStatus && election.publishStatus !== 'published') return json(res,403,{error:'Election is not public'});
        if(String(election.status || '').toLowerCase() !== 'open') return json(res,403,{error:'Election is not open'});
        const today = new Date().toISOString().slice(0,10);
        if(election.startDate && election.startDate > today) return json(res,403,{error:'Election has not started'});
        if(election.endDate && election.endDate < today) return json(res,403,{error:'Election has ended'});
        const candidate = (election.candidates || []).find(c => c.id === j.candidateId);
        if(!candidate) return json(res,400,{error:'Invalid candidate'});
        const existing = getUserVote(election.id, user.id);
        if(existing && !election.allowRevote) return json(res,409,{error:'A vote has already been submitted for this election', receipt:existing.receipt});
        const vote = {
          id: crypto.randomUUID(),
          receipt: voteReceipt(settings.receiptPrefix),
          electionId: election.id,
          candidateId: candidate.id,
          userId: user.id,
          username: user.username,
          createdAt: new Date().toISOString()
        };
        insertOrUpdateVote(vote, !!election.allowRevote);
        audit(existing ? 'vote_replaced' : 'vote_submitted', election.id, {receipt:vote.receipt, candidateId:candidate.id, username:user.username}, req, 'public');
        return json(res,200,{ok:true,receipt:vote.receipt,electionId:election.id,candidateId:candidate.id,dbMode});
      }catch(err){ return json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'GET' && pathname === '/election-api/my-votes'){
    const user = getAccountByToken(authToken(req));
    if(!user) return json(res,401,{error:'Sign in required'});
    const mine = getVotes().filter(v => v.userId === user.id).map(v => ({receipt:v.receipt,electionId:v.electionId,candidateId:v.candidateId,createdAt:v.createdAt}));
    return json(res,200,{votes:mine,dbMode});
  }

  if(req.method === 'GET' && pathname === '/api/backups'){
    return json(res,200,{versions:listContentVersions(),dbMode});
  }

  if(req.method === 'POST' && pathname === '/api/backups/create'){
    return fs.readFile(DATA_FILE,'utf8',(e,d)=>{
      if(e) return json(res,500,{error:e.message});
      const content = safeParse(d, null);
      if(!content) return json(res,500,{error:'Current content JSON is invalid'});
      saveContentVersion(content, 'manual-backup');
      audit('backup_created', 'site-data.json', {}, req, 'dashboard');
      json(res,200,{ok:true,dbMode});
    });
  }

  if(req.method === 'POST' && pathname === '/api/backups/restore'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      const version = getContentVersion(Number(j.id));
      if(!version || !version.content) return json(res,404,{error:'Backup version not found'});
      try{
        saveContentVersion(safeParse(fs.readFileSync(DATA_FILE,'utf8'), {}), 'before-restore');
        atomicWrite(DATA_FILE, JSON.stringify(version.content,null,2));
        audit('backup_restored', String(j.id), {createdAt:version.createdAt,label:version.label}, req, 'dashboard');
        json(res,200,{ok:true,restored:version.id,dbMode});
      }catch(err){ json(res,500,{error:err.message}); }
    });
  }

  if(req.method === 'GET' && pathname === '/api/backups/download-content'){
    return fs.readFile(DATA_FILE,'utf8',(e,d)=>{
      if(e) return json(res,500,{error:e.message});
      audit('backup_download_content', 'site-data.json', {}, req, 'dashboard');
      send(res,200,'application/json',d, {'Content-Disposition':'attachment; filename="site-data.json"'});
    });
  }

  if(req.method === 'GET' && pathname === '/api/backups/download-db'){
    if(!fs.existsSync(DB_FILE)) return json(res,404,{error:'SQLite database file not found'});
    try{
      audit('backup_download_db', 'sqlite-db', {}, req, 'dashboard');
      const buf = fs.readFileSync(DB_FILE);
      send(res,200,'application/octet-stream',buf, {'Content-Disposition':'attachment; filename="separated-kingdom.sqlite"'});
    }catch(e){ json(res,500,{error:e.message}); }
  }

  if(req.method === 'POST' && pathname === '/account-api/register'){
    audit('public_register_blocked', 'public-account', {}, req, 'public');
    return json(res,403,{ok:false,error:'Creating accounts is disabled, contact Separated Kingdom 1900-2803 hotline to register an account.'});
  }

  if(req.method === 'POST' && pathname === '/account-api/login'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      const users = getAccounts();
      const u = users.find(x => x.username === j.username);
      if(!u || !verifyPassword(j.password, u.passwordHash || u.password_hash)){
        audit('login_failed', String(j.username||''), {}, req, 'public');
        return json(res,401,{error:'Invalid username or password'});
      }
      const token = crypto.randomBytes(24).toString('hex');
      insertSession({token, userId:u.id, createdAt:new Date().toISOString()});
      audit('login_success', u.username, {}, req, 'public');
      json(res,200,{ok:true,token,displayName:u.displayName||u.username,username:u.username,email:u.email,accountType:u.accountType,dbMode});
    });
  }

  if(req.method === 'GET' && pathname === '/account-api/my-requests'){
    const user = getAccountByToken(authToken(req));
    if(!user) return json(res,401,{error:'Sign in required'});
    const email = String(user.email || '').toLowerCase();
    const requests = getRequests().filter(r => String(r.email || '').toLowerCase() === email);
    audit('my_requests_viewed', user.username, {count:requests.length}, req, 'public');
    return json(res,200,{requests,dbMode});
  }

  if(req.method === 'GET' && pathname === '/account-api/record-status'){
    const caseNumber = String(url.searchParams.get('caseNumber') || url.searchParams.get('reference') || '').trim().toUpperCase();
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
    if(!caseNumber) return json(res,400,{ok:false,error:'Case number is required'});
    const content = readContent();
    const record = getRecordRegistry(content).find(r => String(r.caseNumber || '').toUpperCase() === caseNumber || String(r.recordTag || '').toUpperCase() === caseNumber);
    const safe = safePublicRegistryRecord(record, email);
    if(!safe){
      audit('record_status_lookup_failed', caseNumber, {}, req, 'public');
      return json(res,404,{ok:false,error:'No matching record found'});
    }
    audit('record_status_lookup', caseNumber, {accessLevel:safe.accessLevel}, req, 'public');
    return json(res,200,{ok:true,record:safe,dbMode});
  }

  if(req.method === 'GET' && pathname === '/account-api/request-status'){
    const reference = String(url.searchParams.get('reference') || '').trim();
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase();
    if(!reference || !email) return json(res,400,{ok:false,error:'Reference and email are required'});
    const request = getRequests().find(r => String(r.reference || '').toUpperCase() === reference.toUpperCase());
    if(!request || String(request.email || '').trim().toLowerCase() !== email){
      audit('request_status_lookup_failed', reference, {}, req, 'public');
      return json(res,404,{ok:false,error:'No matching request found'});
    }
    audit('request_status_lookup', reference, {status:request.status}, req, 'public');
    return json(res,200,{ok:true,request:safePublicRequest(request),dbMode});
  }

  if(req.method === 'POST' && pathname === '/account-api/requests'){
    return readBody(req,(e,j)=>{
      if(e) return json(res,400,{error:e.message});
      if(!j.fullName || !j.email || !j.details) return json(res,400,{error:'Missing required fields'});
      const request = {
        ...j,
        id: crypto.randomUUID(),
        reference: makeRef(j.requestType === 'report' ? 'MID' : (j.requestType === 'records' ? (j.recordAccessType === 'private' ? 'PRV' : 'REC') : 'TAP')),
        status: 'Submitted',
        decisionNote: '',
        decidedAt: '',
        createdAt: new Date().toISOString()
      };
      insertRequest(request);
      audit('request_submitted', request.reference, {requestType:request.requestType,email:request.email}, req, 'public');
      json(res,200,{ok:true,reference:request.reference,dbMode});
    });
  }

  json(res,404,{error:'Not found',path:pathname});
}).listen(PORT, HOST, ()=>console.log('Separated Kingdom API listening on '+HOST+':'+PORT+' using '+dbMode));
