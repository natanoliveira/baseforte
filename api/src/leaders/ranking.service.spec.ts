import { rankScore } from './ranking.service';

describe('rankScore (RN-11)', () => {
  it('meta cheia e atividade máxima = 1', () => expect(rankScore(50, 50, 10, 10)).toBe(1));
  it('meta passa de 100% mas tem teto', () => expect(rankScore(200, 50, 0, 10)).toBe(0.6));
  it('sem meta e sem atividade = 0 (sem dividir por zero)', () => expect(rankScore(5, 0, 0, 0)).toBe(0));
  it('mistura 60/40', () => expect(rankScore(25, 50, 5, 10)).toBe(0.5));
});
