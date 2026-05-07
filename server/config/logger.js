function stamp() {
  return new Date().toISOString();
}

function formatMeta(meta) {
  if (!meta) return '';
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch (_error) {
    return ' [meta-unserializable]';
  }
}

export const logger = {
  info(message, meta) {
    console.log(`[${stamp()}] [INFO] ${message}${formatMeta(meta)}`);
  },
  warn(message, meta) {
    console.warn(`[${stamp()}] [WARN] ${message}${formatMeta(meta)}`);
  },
  error(message, meta) {
    console.error(`[${stamp()}] [ERROR] ${message}${formatMeta(meta)}`);
  }
};

