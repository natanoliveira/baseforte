'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { resolveStyle, TERESINA } from './style';

export function MapView({ onReady }: { onReady?: (map: Map) => void }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: Map | undefined;
    let dead = false;
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    resolveStyle().then(({ style }) => {
      if (dead || !el.current) return;
      const m = (map = new maplibregl.Map({ container: el.current, style, center: TERESINA, zoom: 11 }));
      m.addControl(new maplibregl.NavigationControl(), 'top-right');
      m.once('load', () => {
        el.current?.setAttribute('data-map-ready', 'true');
        onReady?.(m);
      });
    });
    return () => {
      dead = true;
      map?.remove();
      maplibregl.removeProtocol('pmtiles');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={el} className="h-full w-full" data-testid="map" />;
}
