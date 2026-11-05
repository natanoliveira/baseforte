import { Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Public } from '../common/public.decorator';
import { Roles } from '../common/roles.decorator';
import { PrismaService } from '../tenancy/prisma.service';
import { ScopeService } from '../tenancy/scope.service';
import { RemovalService } from './removal.service';

@Controller()
export class RemovalController {
  constructor(
    private readonly removal: RemovalService, private readonly prisma: PrismaService,
    private readonly scope: ScopeService, private readonly cls: ClsService,
  ) {}

  @Public() @Get('public/remove-data/:token')
  info(@Param('token', ParseUUIDPipe) token: string) { return this.removal.tokenInfo(token); }

  @Public() @Post('public/remove-data/:token') @HttpCode(200)
  byToken(@Param('token', ParseUUIDPipe) token: string) { return this.removal.removeByToken(token); }

  /** Descadastro pela equipe, em 1 clique, dentro do escopo do papel. */
  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA') @Post('supporters/:id/revoke') @HttpCode(200)
  async revoke(@Param('id', ParseUUIDPipe) id: string) {
    const ok = await this.prisma.tenant.supporter.findFirst({ where: { AND: [await this.scope.supporterWhere(), { id }] }, select: { id: true } });
    if (!ok) throw new NotFoundException();
    return this.removal.remove(id, this.cls.get('campaignId'), { userId: this.cls.get('userId'), role: this.cls.get('role') }, 'solicitado pela equipe');
  }
}
