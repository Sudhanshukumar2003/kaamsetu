/**
 * Sanitize a string to be safely used as a MongoDB query value.
 * Removes MongoDB operator keys (e.g., $where, $gt) to prevent NoSQL injection.
 */
const sanitizeString = (value) => {
  if (typeof value !== 'string') return '';
  // Reject strings that look like MongoDB operators
  if (/^\$/.test(value.trim())) return '';
  return value.trim();
};

module.exports = { sanitizeString };
