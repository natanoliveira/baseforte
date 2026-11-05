import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { PrismaService } from '../tenancy/prisma.service';
import { TenantUser } from '../tenancy/tenant-context';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private async issue(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { leader: { select: { id: true } } } });
    const payload: TenantUser = {
      sub: u.id,
      campaignId: u.campaignId,
      role: u.role,
      regionId: u.regionId,
      leaderId: u.leader?.id ?? null,
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '15m' });
    const refreshToken = await this.jwt.signAsync({ sub: u.id, typ: 'refresh' }, { expiresIn: '7d' });
    await this.prisma.user.update({ where: { id: u.id }, data: { refreshHash: sha(refreshToken) } });
    return { accessToken, refreshToken };
  }

  async login(email: string, password: string) {
    const u = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!u || !(await argon2.verify(u.passwordHash, password))) throw new UnauthorizedException();
    return this.issue(u.id);
  }

  async refresh(token?: string) {
    if (!token) throw new UnauthorizedException();
    let sub: string;
    try {
      const p = await this.jwt.verifyAsync(token);
      if (p.typ !== 'refresh') throw new Error();
      sub = p.sub;
    } catch {
      throw new UnauthorizedException();
    }
    const u = await this.prisma.user.findUnique({ where: { id: sub } });
    if (!u || u.refreshHash !== sha(token)) throw new UnauthorizedException();
    return this.issue(sub);
  }

  async logout(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshHash: null } });
  }

  async me(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { leader: { select: { id: true } } } });
    return { id: u.id, name: u.name, email: u.email, role: u.role, campaignId: u.campaignId, regionId: u.regionId, leaderId: u.leader?.id ?? null };
  }
}
