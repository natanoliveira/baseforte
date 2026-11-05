import { Injectable, NotFoundException, UnprocessableEntityException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { ClsService } from 'nestjs-cls';
import { SensitiveDataService } from '../common/sensitive-data.service';
import { parsePage, toPage } from '../common/pagination';
import { PrismaService } from '../tenancy/prisma.service';
import { ScopeService } from '../tenancy/scope.service';
import { PlanLimitService } from '../users/plan-limit.service';
import { CreateLeaderDto, ListLeadersQuery, UpdateLeaderDto } from './leaders.dto';
import { computeStatus, statusWhere } from './status.util';

const view = (l: any) => ({
  id: l.id, name: l.name, neighborhoodId: l.neighborhoodId, parentId: l.parentId, coordinatorId: l.coordinatorId,
  zones: l.zones, sections: l.sections, goal: l.goal, lastActivityAt: l.lastActivityAt,
  statusOverride: l.statusOverride, status: computeStatus(l.lastActivityAt, l.statusOverride),
  supporterCount: l._count?.supporters ?? 0,
});

@Injectable()
export class LeadersService {
  constructor(
    private readonly prisma: PrismaService, private readonly scope: ScopeService, private readonly cls: ClsService,
    private readonly sens: SensitiveDataService, private readonly limits: PlanLimitService,
  ) {}

  private async scoped(extra: Prisma.LeaderWhereInput = {}): Promise<Prisma.LeaderWhereInput> {
    return { AND: [await this.scope.leaderWhere(), extra] };
  }

  async list(q: ListLeadersQuery) {
    const { page, pageSize, skip, take } = parsePage(q);
    const extra: Prisma.LeaderWhereInput = {
      ...(q.neighborhoodId && { neighborhoodId: q.neighborhoodId }),
      ...(q.coordinatorId && { coordinatorId: q.coordinatorId }),
      ...((q.goalMin != null || q.goalMax != null) && { goal: { gte: q.goalMin, lte: q.goalMax } }),
      ...(q.status && statusWhere(q.status)),
    };
    const where = await this.scoped(extra);
    const [rows, total] = await Promise.all([
      this.prisma.tenant.leader.findMany({ where, orderBy: { name: 'asc' }, skip, take, include: { _count: { select: { supporters: true } } } }),
      this.prisma.tenant.leader.count({ where }),
    ]);
    return toPage(rows.map(view), total, page, pageSize);
  }

  async get(id: string) {
    const l = await this.prisma.tenant.leader.findFirst({ where: await this.scoped({ id }), include: { _count: { select: { supporters: true } } } });
    if (!l) throw new NotFoundException();
    return { ...view(l), phone: await this.sens.decrypt(l.phoneEnc) };
  }

  /** Bairro/pai/coordenador precisam existir no escopo do chamador. */
  private async assertRefs(dto: { neighborhoodId?: string; parentId?: string; coordinatorId?: string }) {
    if (dto.neighborhoodId) {
      const n = await this.prisma.tenant.neighborhood.findFirst({ where: { AND: [await this.scope.neighborhoodWhere(), { id: dto.neighborhoodId }] } });
      if (!n) throw new UnprocessableEntityException('Bairro inválido');
      if (this.cls.get('role') === 'COORD_REGIAO' && n.regionId !== this.cls.get('regionId')) throw new UnprocessableEntityException('Bairro fora da sua região');
    }
    if (dto.parentId && !(await this.prisma.tenant.leader.findFirst({ where: await this.scoped({ id: dto.parentId }) }))) {
      throw new UnprocessableEntityException('Liderança-pai inválida');
    }
    if (dto.coordinatorId && !(await this.prisma.tenant.user.findFirst({ where: { id: dto.coordinatorId, role: 'COORD_REGIAO' } }))) {
      throw new UnprocessableEntityException('Coordenador inválido');
    }
  }

  async create(dto: CreateLeaderDto) {
    if (!dto.parentId && !dto.coordinatorId) {
      if (this.cls.get('role') === 'COORD_REGIAO') dto.coordinatorId = this.cls.get('userId');
      else throw new UnprocessableEntityException('Informe parentId ou coordinatorId');
    }
    if (dto.parentId && dto.coordinatorId) throw new UnprocessableEntityException('Informe só parentId ou coordinatorId');
    await this.assertRefs(dto);
    await this.limits.assertCanCreateLeader();
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('E-mail já cadastrado');
    const phoneEnc = dto.phone ? await this.sens.encrypt(dto.phone) : undefined;
    const passwordHash = await argon2.hash(dto.password);
    const created = await this.prisma.tenant.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, name: dto.name, role: 'LIDERANCA', passwordHash } as any });
      return tx.leader.create({
        data: {
          userId: user.id, name: dto.name, neighborhoodId: dto.neighborhoodId, parentId: dto.parentId, coordinatorId: dto.coordinatorId,
          zones: dto.zones ?? [], sections: dto.sections ?? [], goal: dto.goal ?? 0, phoneEnc,
        } as any,
        include: { _count: { select: { supporters: true } } },
      });
    });
    return view(created);
  }

  async update(id: string, dto: UpdateLeaderDto) {
    if (!(await this.prisma.tenant.leader.findFirst({ where: await this.scoped({ id }) }))) throw new NotFoundException();
    await this.assertRefs({ neighborhoodId: dto.neighborhoodId });
    const { phone, ...rest } = dto;
    const l = await this.prisma.tenant.leader.update({
      where: { id },
      data: { ...rest, ...(phone !== undefined && { phoneEnc: await this.sens.encrypt(phone) }) } as any,
      include: { _count: { select: { supporters: true } } },
    });
    return view(l);
  }
}
