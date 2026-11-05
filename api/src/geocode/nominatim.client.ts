import { Injectable } from '@nestjs/common';

export interface GeoHit { lat: number; lng: number }

@Injectable()
export class NominatimClient {
  /** User-Agent genérico do app (política de uso do Nominatim). null = endereço não encontrado. */
  async search(address: string): Promise<GeoHit | null> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { 'User-Agent': process.env.NOMINATIM_USER_AGENT || 'baseforte-app' } });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  }
}
