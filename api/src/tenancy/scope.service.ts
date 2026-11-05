import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from './prisma.service';

/** Filtros de escopo por papel (RN-05/RN-08, matriz §5). Sempre usados junto com `prisma.tenant`. */
@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService, private readonly cls: ClsService) {}

  /** id da liderança + todos os descendentes (CTE recursiva). */
  async subtreeIds(leaderId: string): Promise<string[]> {
    const campaignId = this.cls.get('campaignId');
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      WITH RECURSIVE t AS (
        SELECT id FROM "Leader" WHERE id = ${leaderId} AND "campaignId" = ${campaignId}
        UNION
        SELECT l.id FROM "Leader" l JOIN t ON l."parentId" = t.id WHERE l."campaignId" = ${campaignId}
      ) SELECT id FROM t`);
    return rows.map((r) => r.id);
  }

  private deny(): never {
    throw new ForbiddenException();
  }

  async neighborhoodWhere(): Promise<Prisma.NeighborhoodWhereInput> {
    const role = this.cls.get('role');
    if (role === 'CANDIDATO' || role === 'COORD_GERAL') return {};
    if (role === 'COORD_REGIAO') return { regionId: this.cls.get('regionId') ?? '' };
    if (role === 'LIDERANCA') return {}; // bairros são dado geográfico público dentro da campanha
    return this.deny();
  }

  async leaderWhere(): Promise<Prisma.LeaderWhereInput> {
    const role = this.cls.get('role');
    if (role === 'CANDIDATO' || role === 'COORD_GERAL') return {};
    if (role === 'COORD_REGIAO') return { neighborhood: { regionId: this.cls.get('regionId') ?? '' } };
    if (role === 'LIDERANCA') {
      const id = this.cls.get('leaderId');
      return { id: { in: id ? await this.subtreeIds(id) : [] } };
    }
    return this.deny();
  }

  async supporterWhere(): Promise<Prisma.SupporterWhereInput> {
    const role = this.cls.get('role');
    if (role === 'CANDIDATO' || role === 'COORD_GERAL') return {};
    if (role === 'COORD_REGIAO') return { neighborhood: { regionId: this.cls.get('regionId') ?? '' } };
    if (role === 'LIDERANCA') {
      const id = this.cls.get('leaderId');
      return { leaderId: { in: id ? await this.subtreeIds(id) : [] } };
    }
    return this.deny();
  }
}
