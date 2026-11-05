import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, randomInt } from 'crypto';
import { ClsService } from 'nestjs-cls';
import { GeoRepository } from '../common/geo.repository';
import { parsePage, toPage } from '../common/pagination';
import { SensitiveDataService } from '../common/sensitive-data.service';
import { PrismaService } from '../tenancy/prisma.service';
import { ScopeService } from '../tenancy/scope.service';
import { CreateSupporterDto, ListSupportersQuery, UpdateSupporterDto } from './supporters.dto';

/** OQ-01: quem lê o cadastro (já filtrado por escopo) vê endereço/coordenada exata. */
const SEES_EXACT = new Set(['CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA']);

@Injectable()
export class SupportersService {
  constructor(
    private readonly prisma: PrismaService, private readonly scope: ScopeService, private readonly cls: ClsService,
    private readonly sens: SensitiveDataService, private readonly geo: GeoRepository,
  ) {}

  private hashPhone(phone: string) {
    return createHmac('sha256', process.env.APP_ENC_KEY as string).update(phone.replace(/\D/g, '')).digest('hex');
  }

  private async enc(v?: string) {
    return v ? this.sens.encrypt(v) : undefined;
  }

  private async resolveLeaderId(requested?: string) {
    if (this.cls.get('role') === 'LIDERANCA') {
      const own = this.cls.get('leaderId');
      if (!own || (requested && requested !== own)) throw new UnprocessableEntityException('Liderança inválida');
      return own;
    }
    if (!requested) throw new UnprocessableEntityException('Informe leaderId');
    const ok = await this.prisma.tenant.leader.findFirst({ where: { AND: [await this.scope.leaderWhere(), { id: requested }] }, select: { id: true } });
    if (!ok) throw new UnprocessableEntityException('Liderança inválida');
    return requested;
  }

  private async assertNeighborhood(id: string) {
    const n = await this.prisma.tenant.neighborhood.findFirst({ where: { AND: [await this.scope.neighborhoodWhere(), { id }] }, select: { id: true } });
    if (!n) throw new UnprocessableEntityException('Bairro inválido');
  }

  async create(dto: CreateSupporterDto) {
    if (!dto.consent) throw new UnprocessableEntityException({ code: 'CONSENT_REQUIRED', message: 'Consentimento é obrigatório' });
    if ((dto.lat == null) !== (dto.lng == null)) throw new UnprocessableEntityException('Informe lat e lng juntos');
    const leaderId = await this.resolveLeaderId(dto.leaderId);
    await this.assertNeighborhood(dto.neighborhoodId);

    const phoneHash = dto.phone ? this.hashPhone(dto.phone) : undefined;
    const duplicatePhone = phoneHash ? (await this.prisma.tenant.supporter.count({ where: { phoneHash, anonymizedAt: null } })) > 0 : false;
    const [phoneEnc, cpfEnc, addressEnc] = await Promise.all([this.enc(dto.phone), this.enc(dto.cpf), this.enc(dto.address)]);
    const jitterSeed = randomInt(1, 2_000_000_000);
    const consent = dto.consent;

    const created = await this.prisma.tenant.$transaction(async (tx) => {
      const s = await tx.supporter.create({
        data: { name: dto.name, leaderId, neighborhoodId: dto.neighborhoodId, phoneEnc, phoneHash, cpfEnc, addressEnc, jitterSeed } as any,
        select: { id: true, name: true, leaderId: true, neighborhoodId: true, geocodeStatus: true, removalToken: true },
      });
      await tx.consent.create({ data: { supporterId: s.id, ...consent, collectedById: this.cls.get('userId') } as any });
      await tx.leader.update({ where: { id: leaderId }, data: { lastActivityAt: new Date() } });
      return s;
    });
    if (dto.lat != null && dto.lng != null) await this.geo.setSupporterLocation(created.id, dto.lat, dto.lng, jitterSeed);
    const { removalToken, ...pub } = created;
    return { ...pub, duplicatePhone };
  }

  async list(q: ListSupportersQuery) {
    const { page, pageSize, skip, take } = parsePage(q);
    const where: Prisma.SupporterWhereInput = {
      AND: [
        await this.scope.supporterWhere(),
        { anonymizedAt: null },
        ...(q.leaderId ? [{ leaderId: q.leaderId }] : []),
        ...(q.neighborhoodId ? [{ neighborhoodId: q.neighborhoodId }] : []),
        ...(q.q ? [{ name: { contains: q.q, mode: 'insensitive' as const } }] : []),
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.tenant.supporter.findMany({
        where, orderBy: { name: 'asc' }, skip, take,
        select: { id: true, name: true, leaderId: true, neighborhoodId: true, geocodeStatus: true, createdAt: true, consents: { where: { revokedAt: null }, select: { id: true }, take: 1 } },
      }),
      this.prisma.tenant.supporter.count({ where }),
    ]);
    return toPage(rows.map(({ consents, ...r }) => ({ ...r, hasActiveConsent: consents.length > 0 })), total, page, pageSize);
  }

  async get(id: string) {
    const s = await this.prisma.tenant.supporter.findFirst({
      where: { AND: [await this.scope.supporterWhere(), { id }] },
      include: { consents: { orderBy: { grantedAt: 'desc' } } },
    });
    if (!s) throw new NotFoundException();
    const exact = SEES_EXACT.has(this.cls.get('role')) && !s.anonymizedAt;
    const loc = exact && s.locationEnc ? JSON.parse((await this.sens.decrypt(s.locationEnc)) as string) : null;
    return {
      id: s.id, name: s.name, leaderId: s.leaderId, neighborhoodId: s.neighborhoodId, geocodeStatus: s.geocodeStatus,
      anonymizedAt: s.anonymizedAt, createdAt: s.createdAt,
      phone: exact ? await this.sens.decrypt(s.phoneEnc) : null,
      cpf: exact ? await this.sens.decrypt(s.cpfEnc) : null,
      address: exact ? await this.sens.decrypt(s.addressEnc) : null,
      location: loc,
      consents: s.consents.map((c) => ({ id: c.id, grantedAt: c.grantedAt, channel: c.channel, purpose: c.purpose, textVersion: c.textVersion, revokedAt: c.revokedAt })),
    };
  }

  async update(id: string, dto: UpdateSupporterDto) {
    const s = await this.prisma.tenant.supporter.findFirst({ where: { AND: [await this.scope.supporterWhere(), { id, anonymizedAt: null }] } });
    if (!s) throw new NotFoundException();
    if ((dto.lat == null) !== (dto.lng == null)) throw new UnprocessableEntityException('Informe lat e lng juntos');
    if (dto.neighborhoodId) await this.assertNeighborhood(dto.neighborhoodId);
    const { phone, cpf, address, lat, lng, ...rest } = dto;
    await this.prisma.tenant.supporter.update({
      where: { id },
      data: {
        ...rest,
        ...(phone !== undefined && { phoneEnc: await this.sens.encrypt(phone), phoneHash: this.hashPhone(phone) }),
        ...(cpf !== undefined && { cpfEnc: await this.sens.encrypt(cpf) }),
        ...(address !== undefined && { addressEnc: await this.sens.encrypt(address) }),
      } as any,
    });
    if (lat != null && lng != null) await this.geo.setSupporterLocation(id, lat, lng, s.jitterSeed);
    return this.get(id);
  }
}
