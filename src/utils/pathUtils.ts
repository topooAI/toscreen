/**
 * Converts a raw file path to a proper file:// URL that can be loaded by the renderer.
 */
export const toFileUrl = (path: string) => {
  if (!path) return '';
  // Normalize backslashes to forward slashes
  const normalized = path.replace(/\\/g, '/');
  // If it's already a file URL, return as is
  if (normalized.startsWith('file://')) return normalized;
  // Use native URL constructor for proper encoding
  try {
    return new URL(`file://${normalized.startsWith('/') ? '' : '/'}${normalized}`).href;
  } catch (e) {
    return `file://${normalized}`;
  }
};
