// Almacén de datos privados: configuración, secreto de firma, credenciales del panel y medios subidos.
// TODO lo que está en DATA_DIR es privado y jamás se sirve como fichero estático.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { defaultConfig } from './default-config.js';
import { hashPassword, rid } from './util.js';

export class Store {
  constructor(dir) {
    this.dir = path.resolve(dir);
    this.mediaDir = path.join(this.dir, 'media');
    this.backupDir = path.join(this.dir, 'backups');
    for (const d of [this.dir, this.mediaDir, this.backupDir]) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
    this.cfgPath = path.join(this.dir, 'config.json');
    this.secretPath = path.join(this.dir, 'secret.key');
    this.adminPath = path.join(this.dir, 'admin.json');
    this.secret = this._secret();
    this.config = this._load();
    this.admin = null;
    this.newAdminPassword = null;
  }

  _secret() {
    if (fs.existsSync(this.secretPath)) return fs.readFileSync(this.secretPath, 'utf8').trim();
    const s = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(this.secretPath, s, { mode: 0o600 });
    return s;
  }

  _load() {
    if (fs.existsSync(this.cfgPath)) {
      try { return JSON.parse(fs.readFileSync(this.cfgPath, 'utf8')); }
      catch (e) { throw new Error('config.json está corrupto (' + e.message + '). Restaura una copia de data/backups/.'); }
    }
    const cfg = defaultConfig();
    this.writeAtomic(this.cfgPath, JSON.stringify(cfg, null, 2));
    return cfg;
  }

  writeAtomic(file, data) {
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, data, { mode: 0o600 });
    fs.renameSync(tmp, file);
  }

  save(cfg) {
    // Copia de seguridad rotatoria de la versión anterior
    try {
      if (fs.existsSync(this.cfgPath)) {
        fs.copyFileSync(this.cfgPath, path.join(this.backupDir, 'config-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'));
        const old = fs.readdirSync(this.backupDir).filter((f) => f.startsWith('config-')).sort();
        while (old.length > 30) fs.unlinkSync(path.join(this.backupDir, old.shift()));
      }
    } catch { /* la copia es best-effort */ }
    this.writeAtomic(this.cfgPath, JSON.stringify(cfg, null, 2));
    this.config = cfg;
  }

  /** Credenciales del panel. Primera vez: ADMIN_PASSWORD o contraseña aleatoria impresa UNA vez en consola. */
  initAdmin(envPassword) {
    if (fs.existsSync(this.adminPath)) { this.admin = JSON.parse(fs.readFileSync(this.adminPath, 'utf8')); return; }
    const pw = envPassword || crypto.randomBytes(9).toString('base64url');
    this.admin = hashPassword(pw);
    this.writeAtomic(this.adminPath, JSON.stringify(this.admin));
    this.newAdminPassword = envPassword ? null : pw;
  }
  setAdminPassword(pw) {
    this.admin = hashPassword(pw);
    this.writeAtomic(this.adminPath, JSON.stringify(this.admin));
  }

  // ── Medios ──
  mediaPath(file) { return path.join(this.mediaDir, path.basename(file)); }
  newMediaFile(ext) { const id = 'm' + rid(7); return { id, file: id + '.' + ext }; }
  deleteMediaFile(file) { try { fs.unlinkSync(this.mediaPath(file)); } catch { /* ya no existe */ } }
}
