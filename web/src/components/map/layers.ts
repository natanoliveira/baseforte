import type { Map, GeoJSONSource } from 'maplibre-gl';

export const GROUPS = {
  pins: { label: 'Lideranças', layers: ['clusters', 'cluster-count', 'pins'] },
  heat: { label: 'Calor de apoiadores', layers: ['heat'] },
  choro: { label: '% da meta por bairro', layers: ['choro-fill', 'choro-line'] },
  gaps: { label: 'Bairros vazios', layers: ['gaps-fill', 'gaps-line'] },
  voting: { label: 'Locais de votação', layers: ['voting'] },
} as const;
export type GroupKey = keyof typeof GROUPS;

const empty = { type: 'FeatureCollection' as const, features: [] };
const STATUS = ['match', ['get', 'status'], 'ATIVO', '#16a34a', 'FRIO', '#f59e0b', '#9ca3af'];

export function addLayers(map: Map) {
  map.addSource('choro', { type: 'geojson', data: empty });
  map.addSource('gaps', { type: 'geojson', data: empty });
  map.addSource('heat', { type: 'geojson', data: empty });
  map.addSource('voting', { type: 'geojson', data: empty });
  map.addSource('leaders', { type: 'geojson', data: empty, cluster: true, clusterRadius: 40, clusterMaxZoom: 14 });

  map.addLayer({ id: 'choro-fill', type: 'fill', source: 'choro', paint: {
    'fill-opacity': 0.55,
    'fill-color': ['case', ['==', ['get', 'pct'], null], '#d1d5db',
      ['interpolate', ['linear'], ['get', 'pct'], 0, '#dc2626', 50, '#f59e0b', 100, '#16a34a']],
  } });
  map.addLayer({ id: 'choro-line', type: 'line', source: 'choro', paint: { 'line-color': '#475569', 'line-width': 1 } });
  map.addLayer({ id: 'gaps-fill', type: 'fill', source: 'gaps', paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.25 } });
  map.addLayer({ id: 'gaps-line', type: 'line', source: 'gaps', paint: { 'line-color': '#dc2626', 'line-width': 2, 'line-dasharray': [2, 2] } });
  map.addLayer({ id: 'heat', type: 'heatmap', source: 'heat', paint: { 'heatmap-radius': 22, 'heatmap-opacity': 0.7 } });
  map.addLayer({ id: 'voting', type: 'circle', source: 'voting', paint: { 'circle-radius': 4, 'circle-color': '#6366f1', 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } });
  map.addLayer({ id: 'clusters', type: 'circle', source: 'leaders', filter: ['has', 'point_count'], paint: {
    'circle-color': '#0f766e', 'circle-radius': ['step', ['get', 'point_count'], 14, 5, 18, 15, 24],
  } });
  map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'leaders', filter: ['has', 'point_count'],
    layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 }, paint: { 'text-color': '#fff' } });
  map.addLayer({ id: 'pins', type: 'circle', source: 'leaders', filter: ['!', ['has', 'point_count']], paint: {
    'circle-color': STATUS as any,
    'circle-radius': ['interpolate', ['linear'], ['get', 'supporters'], 0, 5, 80, 14],
    'circle-stroke-width': 2, 'circle-stroke-color': '#fff',
  } });
}

export function setData(map: Map, source: string, data: GeoJSON.FeatureCollection) {
  (map.getSource(source) as GeoJSONSource | undefined)?.setData(data);
}

export function toggle(map: Map, group: GroupKey, on: boolean) {
  for (const id of GROUPS[group].layers) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}
