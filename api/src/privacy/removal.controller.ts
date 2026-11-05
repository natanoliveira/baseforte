import { Body, Controller, Get, HttpCode, Patch, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Public } from '../common/public.decorator';
import { RateLimit } from '../common/rate-limit';
import { Roles } from '../common/roles.decorator';
import { PrismaService } from '../tenancy/prisma.service';
import { ScopeService } from '../tenancy/scope.service';
import { LogAccess } from '../common/access-log.interceptor';
import { removalUrl } from './removal-url';
import { RemovalService } from './removal.service';
import { CorrectDataDto } from './titular.dto';
import { TitularService } from './titular.service';

@Controller()
export class RemovalController {
  constructor(
    private readonly removal: RemovalService, private readonly titular: TitularService, private readonly prisma: PrismaService,
    private readonly scope: ScopeService, private readonly cls: ClsService,
  ) {}

  @Public() @RateLimit({ name: 'remove-info', max: 30, windowMs: 60_000 }) @Get('public/remove-data/:token')
  info(@Param('token', ParseUUIDPipe) token: string) { return this.removal.tokenInfo(token); }

  @Public() @RateLimit({ name: 'remove', max: 10, windowMs: 60_000 }) @Post('public/remove-data/:token') @HttpCode(200)
  byToken(@Param('token', ParseUUIDPipe) token: string) { return this.removal.removeByToken(token); }

  /** Acesso e portabilidade do titular (LGPD art. 18). */
  @Public() @RateLimit({ name: 'my-data', max: 30, windowMs: 60_000 }) @Get('public/my-data/:token')
  myData(@Param('token', ParseUUIDPipe) token: string) { return this.titular.export(token); }

  /** Correção pelo titular. */
  @Public() @RateLimit({ name: 'my-data-fix', max: 10, windowMs: 60_000 }) @Patch('public/my-data/:token')
  correct(@Param('token', ParseUUIDPipe) token: string, @Body() dto: CorrectDataDto) { return this.titular.correct(token, dto); }

  /** Link público de descadastro para entregar ao titular (RF-22). */
  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA') @Get('supporters/:id/removal-link') @LogAccess('supporter', 'REMOVAL_LINK')
  async link(@Param('id', ParseUUIDPipe) id: string) {
    const s = await this.prisma.tenant.supporter.findFirst({ where: { AND: [await this.scope.supporterWhere(), { id }, { anonymizedAt: null }] }, select: { removalToken: true } });
    if (!s) throw new NotFoundException();
    return { url: removalUrl(s.removalToken) };
  }

  /** Descadastro pela equipe, em 1 clique, dentro do escopo do papel. */
  @Roles('CANDIDATO', 'COORD_GERAL', 'COORD_REGIAO', 'LIDERANCA') @Post('supporters/:id/revoke') @HttpCode(200)
  async revoke(@Param('id', ParseUUIDPipe) id: string) {
    const ok = await this.prisma.tenant.supporter.findFirst({ where: { AND: [await this.scope.supporterWhere(), { id }] }, select: { id: true } });
    if (!ok) throw new NotFoundException();
    return this.removal.remove(id, this.cls.get('campaignId'), { userId: this.cls.get('userId'), role: this.cls.get('role') }, 'solicitado pela equipe');
  }
}
