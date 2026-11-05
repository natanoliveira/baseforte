import { Role } from '@baseforte/shared';

declare module 'nestjs-cls' {
  interface ClsStore {
    campaignId: string;
    userId: string;
    role: Role;
    regionId?: string | null;
    leaderId?: string | null;
  }
}

export interface TenantUser {
  sub: string;
  campaignId: string;
  role: Role;
  regionId?: string | null;
  leaderId?: string | null;
}
