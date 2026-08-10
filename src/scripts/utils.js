/**
 * SHC Digital — utils.js
 * Funciones compartidas entre scripts/app.js y scripts/briefing.js.
 */

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
