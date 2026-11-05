import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../tenancy/prisma.service';
import { ScopeService } from '../tenancy/scope.service';
import { computeStatus } from './status.util';

export class MoveLeaderDto {
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsUUID() coordinatorId?: string;
}

@Injectable()
export class TreeService {
  constructor(private readonly prisma: PrismaService, private readonly scope: ScopeService, private readonly cls: ClsService) {}

  /** Lista plana (o front monta a árvore): coordenadores de região + lideranças no escopo. */
  async tree() {
    const role = this.cls.get('role');
    const coordWhere =
      role === 'LIDERANCA' ? { id: '' }
      : role === 'COORD_REGIAO' ? { role: 'COORD_REGIAO' as const, regionId: this.cls.get('regionId') ?? '' }
      : { role: 'COORD_REGIAO' as const };
    const [coordinators, leaders] = await Promise.all([
      this.prisma.tenant.user.findMany({ where: coordWhere, select: { id: true, name: true, regionId: true }, orderBy: { name: 'asc' } }),
      this.prisma.tenant.leader.findMany({
        where: await this.scope.leaderWhere(),
        include: { _count: { select: { supporters: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      coordinators,
      leaders: leaders.map((l) => ({
        id: l.id, name: l.name, parentId: l.parentId, coordinatorId: l.coordinatorId, goal: l.goal,
        supporterCount: l._count.supporters, status: computeStatus(l.lastActivityAt, l.statusOverride),
      })),
    };
  }

  /** Move a liderança (e, por consequência, toda a subárvore) para outro pai ou coordenador (RN-09). */
  async move(id: string, dto: MoveLeaderDto) {
    if (!!dto.parentId === !!dto.coordinatorId) throw new UnprocessableEntityException('Informe parentId ou coordinatorId');
    const where = await this.scope.leaderWhere();
    if (!(await this.prisma.tenant.leader.findFirst({ where: { AND: [where, { id }] }, select: { id: true } }))) throw new NotFoundException();

    if (dto.parentId) {
      if (!(await this.prisma.tenant.leader.findFirst({ where: { AND: [where, { id: dto.parentId }] }, select: { id: true } }))) {
        throw new UnprocessableEntityException('Liderança-pai inválida');
      }
      if ((await this.scope.subtreeIds(id)).includes(dto.parentId)) throw new UnprocessableEntityException('Movimento criaria um ciclo');
    } else {
      const c = await this.prisma.tenant.user.findFirst({ where: { id: dto.coordinatorId, role: 'COORD_REGIAO' } });
      if (!c) throw new UnprocessableEntityException('Coordenador inválido');
      if (this.cls.get('role') === 'COORD_REGIAO' && c.regionId !== this.cls.get('regionId')) {
        throw new UnprocessableEntityException('Coordenador fora da sua região');
      }
    }

    return this.prisma.tenant.$transaction(async (tx) => {
      const moved = await tx.leader.update({
        where: { id },
        data: { parentId: dto.parentId ?? null, coordinatorId: dto.coordinatorId ?? null },
        select: { id: true, parentId: true, coordinatorId: true },
      });
      await tx.accessLog.create({
        data: { userId: this.cls.get('userId'), role: this.cls.get('role'), resource: 'leader', resourceId: id, action: 'MOVE', outcome: 'OK' } as any,
      });
      return moved;
    });
  }
}
