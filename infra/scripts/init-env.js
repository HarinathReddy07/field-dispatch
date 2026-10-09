'use strict';
/**
 * Creates .env from .env.example with every CHANGE_ME_* placeholder replaced by a fresh random value.
 * The same placeholder gets the same value everywhere it appears (e.g. the Postgres password inside DATABASE_URL).
 * Never overwrites an existing .env.
 *
 *   node infra/scripts/init-env.js
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const example = path.join(root, '.env.example');
const target = path.join(root, '.env');

if (fs.existsSync(target)) {
  process.stdout.write('init-env: .env already exists, leaving it untouched\n');
  process.exit(0);
}

const values = new Map();
const generate = (placeholder) => {
  if (!values.has(placeholder)) {
    // Storage credentials are short alphanumerics (some S3 servers restrict them); everything else is 48 hex chars.
    values.set(
      placeholder,
      /storage_access/.test(placeholder)
        ? 'dsp' + crypto.randomBytes(8).toString('hex')
        : crypto.randomBytes(24).toString('hex'),
    );
  }
  return values.get(placeholder);
};

const text = fs.readFileSync(example, 'utf8').replace(/CHANGE_ME_[A-Za-z0-9_]+/g, generate);
fs.writeFileSync(target, text, { mode: 0o600 });
process.stdout.write(`init-env: wrote .env with ${values.size} generated secrets (kept out of git)\n`);
