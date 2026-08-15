export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function pad(value: number, size = 2) {
  return String(Math.floor(Math.abs(value))).padStart(size, '0');
}

export function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

export function formatDurationLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '—';
  }
  return formatClock(seconds);
}

export function parseTimestampInput(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) {
    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = match[3] ? Number(match[3].padEnd(3, '0').slice(0, 3)) / 1000 : 0;
  return minutes * 60 + seconds + fraction;
}

export function formatTimestampInput(seconds: number) {
  const clamped = Math.max(0, seconds);
  const m = Math.floor(clamped / 60);
  const s = clamped - m * 60;
  const hundredths = Math.round((s % 1) * 100);
  return `${pad(m)}:${pad(Math.floor(s))}.${pad(hundredths)}`;
}

export function srtTimestamp(seconds: number) {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.floor((clamped % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

export function assTimestamp(seconds: number) {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped - h * 3600 - m * 60;
  return `${h}:${pad(m)}:${s.toFixed(2).padStart(5, '0')}`;
}

export function normalizePickerDuration(value?: number | null) {
  if (!value || value <= 0) {
    return 0;
  }
  return value > 3600 ? value / 1000 : value;
}
