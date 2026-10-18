import { timingSafeEqual } from 'node:crypto';

// Access codes come from two variables:
//   ACCESS_CODES  per-person codes, "Name=code" pairs separated by ";" or new lines
//   ACCESS_CODE   optional shared code, tracked as "Team"
// ADMIN_CODE opens the usage page; it is not a lookup code.
export function parseAccessCodes({ ACCESS_CODES = '', ACCESS_CODE = '' } = process.env) {
  const users = [];
  for (const entry of ACCESS_CODES.split(/[;\n]/)) {
    const i = entry.indexOf('=');
    if (i < 1) continue;
    const name = entry.slice(0, i).trim();
    const code = entry.slice(i + 1).trim();
    if (name && code) users.push({ name, code });
  }
  if (ACCESS_CODE.trim()) users.push({ name: 'Team', code: ACCESS_CODE.trim() });
  return users;
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Returns the user name for a code, null for a wrong code, or 'Open access'
 * when no codes are configured at all.
 */
export function identify(code, users) {
  if (!users.length) return 'Open access';
  if (!code) return null;
  // Compare against every code so timing doesn't reveal which one matched.
  let match = null;
  for (const u of users) {
    if (safeEqual(code, u.code) && !match) match = u.name;
  }
  return match;
}
