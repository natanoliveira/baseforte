import { distanceMeters, jitterPoint } from './jitter';

const P = { lat: -5.0892, lng: -42.8019 };

describe('jitterPoint (RN-14, CA-03)', () => {
  it('fica entre 30 e 200 m do ponto real, para muitas seeds', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const d = distanceMeters(P, jitterPoint(P.lat, P.lng, seed));
      expect(d).toBeGreaterThanOrEqual(29);
      expect(d).toBeLessThanOrEqual(201);
    }
  });
  it('é determinístico por seed e varia entre seeds', () => {
    expect(jitterPoint(P.lat, P.lng, 7)).toEqual(jitterPoint(P.lat, P.lng, 7));
    expect(jitterPoint(P.lat, P.lng, 7)).not.toEqual(jitterPoint(P.lat, P.lng, 8));
  });
});
