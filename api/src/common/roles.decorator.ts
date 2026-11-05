import { SetMetadata } from '@nestjs/common';
import { Role } from '@baseforte/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const ALL_ROLES = Object.values(Role) as Role[];
export const AnyRole = () => Roles(...ALL_ROLES);
