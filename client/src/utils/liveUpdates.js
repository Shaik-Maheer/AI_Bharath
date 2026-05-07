const DATA_UPDATED_EVENT = 'adhikarloop:data-updated';
const DATA_UPDATED_STORAGE_KEY = 'adhikarloop_data_updated';

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function publishDataUpdate(reason = 'system') {
  if (typeof window === 'undefined') return;

  const payload = {
    reason,
    at: Date.now()
  };
  const serialized = JSON.stringify(payload);

  window.localStorage.setItem(DATA_UPDATED_STORAGE_KEY, serialized);
  window.dispatchEvent(new CustomEvent(DATA_UPDATED_EVENT, { detail: payload }));
}

export function subscribeDataUpdates(listener) {
  if (typeof window === 'undefined') return () => {};

  const onCustom = (event) => listener(event.detail || null);
  const onStorage = (event) => {
    if (event.key !== DATA_UPDATED_STORAGE_KEY || !event.newValue) return;
    listener(safeParse(event.newValue));
  };

  window.addEventListener(DATA_UPDATED_EVENT, onCustom);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(DATA_UPDATED_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
