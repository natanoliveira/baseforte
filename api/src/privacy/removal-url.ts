export const removalUrl = (token: string) => `${process.env.WEB_URL ?? 'http://localhost:3006'}/remover-dados/${token}`;
