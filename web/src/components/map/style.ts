import type { StyleSpecification } from 'maplibre-gl';

export const ONLINE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
export const FALLBACK_STYLE = '/map/fallback-style.json';
export const PMTILES_URL = '/map/teresina.pmtiles';
export const TERESINA: [number, number] = [-42.8019, -5.0892];

async function exists(url: string, ms = 2500) {
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(ms) });
    return r.ok;
  } catch {
    return false;
  }
}

/** Ordem: OpenFreeMap online → PMTiles local (se o arquivo existir) → fallback só com bairros. */
export async function resolveStyle(): Promise<{ style: string | StyleSpecification; pmtiles: boolean }> {
  if (await exists(ONLINE_STYLE)) return { style: ONLINE_STYLE, pmtiles: false };
  const base: StyleSpecification = await (await fetch(FALLBACK_STYLE)).json();
  if (await exists(PMTILES_URL)) {
    base.sources.base = { type: 'vector', url: `pmtiles://${PMTILES_URL}` };
    base.layers.splice(1, 0,
      { id: 'water', type: 'fill', source: 'base', 'source-layer': 'water', paint: { 'fill-color': '#b9d6ee' } },
      { id: 'roads', type: 'line', source: 'base', 'source-layer': 'roads', paint: { 'line-color': '#fff', 'line-width': 1 } },
    );
    return { style: base, pmtiles: true };
  }
  return { style: base, pmtiles: false };
}
