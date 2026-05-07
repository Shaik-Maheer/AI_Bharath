export function formatDate(value) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function daysRemaining(value) {
  const deadline = new Date(value);
  const today = new Date();
  deadline.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
}

export function dateInputValue(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

