export function renderLocation(loc, isAr) {
  if (!loc?.lat || !loc?.lng) return '—';
  const accuracy = loc.accuracy
    ? isAr
      ? ` (±${Math.round(loc.accuracy)}م)`
      : ` (±${Math.round(loc.accuracy)}m)`
    : '';
  return `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}${accuracy}`;
}