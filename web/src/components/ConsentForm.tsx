'use client';

export const CONSENT_VERSION = 'v1';
export const CONSENT_TEXT =
  'Autorizo o tratamento dos meus dados pessoais, incluindo a manifestação de apoio político (dado sensível), para contato e organização da campanha, ciente de que posso remover meus dados a qualquer momento.';
export const CHANNELS = ['PRESENCIAL', 'WHATSAPP', 'FORMULARIO'] as const;

export function ConsentForm({ checked, onChange, channel, onChannel }: {
  checked: boolean; onChange: (v: boolean) => void; channel: string; onChannel: (v: string) => void;
}) {
  return (
    <fieldset className="space-y-2 rounded border bg-accent/15 p-3 text-sm">
      <legend className="px-1 font-medium">Consentimento (LGPD)</legend>
      <p>{CONSENT_TEXT}</p>
      <label className="block">Canal da coleta
        <select value={channel} onChange={(e) => onChannel(e.target.value)} className="ml-2 rounded border px-2 py-1">
          {CHANNELS.map((c) => <option key={c} value={c}>{c.toLowerCase()}</option>)}
        </select>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
        O apoiador leu e aceitou o termo acima.
      </label>
    </fieldset>
  );
}
