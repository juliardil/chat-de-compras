// Enmascarado de datos personales para el modo demostración y para la
// presentación de respuestas ya enmascaradas por el servidor.
// En modo InsForge el enmascarado real ocurre en las funciones SQL.

export function maskEmail(value) {
  const email = String(value || '').trim();
  if (!email) return '—';
  const at = email.indexOf('@');
  if (at <= 0) return '••••';
  return `${email[0]}***${email.slice(at)}`;
}

export function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '—';
  return `•••• ${digits.slice(-4)}`;
}

export function maskTaxId(value) {
  const clean = String(value || '').trim();
  if (!clean) return '—';
  return `••••${clean.slice(-4)}`;
}

export function maskText(value) {
  return String(value || '').trim() ? '••••••' : '—';
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
