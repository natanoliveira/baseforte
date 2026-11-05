import { computeStatus } from './status.util';

const now = new Date('2027-03-01T12:00:00Z');
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe('computeStatus (CA-07)', () => {
  it.each([[0, 'ATIVO'], [14, 'ATIVO'], [15, 'FRIO'], [20, 'FRIO'], [45, 'FRIO'], [46, 'INATIVO']])('%i dias → %s', (d, s) => {
    expect(computeStatus(ago(d), null, now)).toBe(s);
  });
  it('sem atividade → INATIVO', () => expect(computeStatus(null, null, now)).toBe('INATIVO'));
  it('override manual vence', () => expect(computeStatus(ago(20), 'ATIVO', now)).toBe('ATIVO'));
});
