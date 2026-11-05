import { Injectable, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { SensitiveDataService } from '../common/sensitive-data.service';
import { PrismaService } from '../tenancy/prisma.service';
import { CorrectDataDto } from './titular.dto';

/** Direitos do titular via token (LGPD art. 18: acesso, correção, portabilidade). Rota pública: usa o client sem extension. */
@Injectable()
export class TitularService {
  constructor(private readonly prisma: PrismaService, private readonly sens: SensitiveDataService) {}

  private async find(token: string) {
    const s = await this.prisma.supporter.findUnique({ where: { removalToken: token }, include: { consents: { orderBy: { grantedAt: 'desc' } }, campaign: { select: { name: true } } } });
    if (!s || s.anonymizedAt) throw new NotFoundException();
    return s;
  }

  private log(s: { id: string; campaignId: string }, action: string) {
    return this.prisma.accessLog.create({ data: { campaignId: s.campaignId, userId: null, role: null, resource: 'supporter', resourceId: s.id, action, outcome: 'OK' } });
  }

  /** Acesso e portabilidade: tudo que guardamos do titular, em JSON estruturado (o mesmo serve para download). */
  async export(token: string) {
    const s = await this.find(token);
    await this.log(s, 'TITULAR_ACCESS');
    return {
      campaign: s.campaign.name, exportedAt: new Date().toISOString(),
      name: s.name, phone: await this.sens.decrypt(s.phoneEnc), cpf: await this.sens.decrypt(s.cpfEnc), address: await this.sens.decrypt(s.addressEnc),
      createdAt: s.createdAt,
      consents: s.consents.map((c) => ({ grantedAt: c.grantedAt, channel: c.channel, purpose: c.purpose, textVersion: c.textVersion, revokedAt: c.revokedAt })),
    };
  }

  /** Correção: só dados que o titular informou (nome, telefone, CPF, endereço). */
  async correct(token: string, dto: CorrectDataDto) {
    const s = await this.find(token);
    const { name, phone, cpf, address } = dto;
    await this.prisma.supporter.update({
      where: { id: s.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phoneEnc: await this.sens.encrypt(phone), phoneHash: createHmac('sha256', process.env.APP_ENC_KEY as string).update(phone.replace(/\D/g, '')).digest('hex') }),
        ...(cpf !== undefined && { cpfEnc: await this.sens.encrypt(cpf) }),
        ...(address !== undefined && { addressEnc: await this.sens.encrypt(address) }),
      },
    });
    await this.log(s, 'TITULAR_CORRECT');
    return this.export(token);
  }
}
