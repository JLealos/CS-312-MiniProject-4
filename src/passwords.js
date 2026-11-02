const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const deriveKey = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [algorithm, salt, encodedKey] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !encodedKey) return false;
  const expected = Buffer.from(encodedKey, 'hex');
  const actual = await deriveKey(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

module.exports = { hashPassword, verifyPassword };
