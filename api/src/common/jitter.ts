const M_PER_DEG_LAT = 111_320;

/** PRNG determinístico (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Desloca o ponto entre MIN e MAX metros, de forma estável por seed (RN-14). Nunca devolve o ponto exato. */
export function jitterPoint(lat: number, lng: number, seed: number, maxMeters = 200, minMeters = 30) {
  const r = rng(seed);
  const angle = r() * 2 * Math.PI;
  const dist = minMeters + (maxMeters - minMeters) * Math.sqrt(r());
  const dLat = (dist * Math.cos(angle)) / M_PER_DEG_LAT;
  const dLng = (dist * Math.sin(angle)) / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
