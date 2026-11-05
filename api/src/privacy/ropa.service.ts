import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../tenancy/prisma.service';

export interface RopaRow { operacao: string; finalidade: string; baseLegal: string; dados: string; titulares: string; compartilhamento: string; retencao: string; seguranca: string }

const SEC = 'Criptografia em repouso (pgcrypto), TLS, controle de acesso por papel, log de acesso a cada cadastro';

@Injectable()
export class RopaService {
  constructor(private readonly prisma: PrismaService, private readonly cls: ClsService) {}

  async build() {
    const campaign = await this.prisma.campaign.findUniqueOrThrow({ where: { id: this.cls.get('campaignId') } });
    const [supporters, withConsent, removals] = await Promise.all([
      this.prisma.tenant.supporter.count({ where: { anonymizedAt: null } }),
      this.prisma.tenant.supporter.count({ where: { anonymizedAt: null, consents: { some: { revokedAt: null } } } }),
      this.prisma.tenant.removalRecord.count(),
    ]);
    const retencao = campaign.retentionPolicy === 'APAGAR'
      ? 'Até o encerramento da campanha; depois, exclusão'
      : 'Até o encerramento da campanha; depois, anonimização';
    const base = 'Consentimento do titular (LGPD art. 7º, I e art. 11, I)';
    const rows: RopaRow[] = [
      { operacao: 'Cadastro de apoiadores', finalidade: 'Organizar a relação da campanha com apoiadores', baseLegal: base, dados: 'Nome, telefone, CPF (opcional), endereço, localização, apoio político (dado sensível, art. 5º, II)', titulares: 'Apoiadores', compartilhamento: 'Nenhum', retencao, seguranca: SEC },
      { operacao: 'Comunicação individual', finalidade: 'Contato por link wa.me enviado manualmente pelo usuário', baseLegal: base, dados: 'Nome, telefone', titulares: 'Apoiadores com consentimento ativo', compartilhamento: 'Nenhum (envio manual pelo usuário)', retencao, seguranca: SEC },
      { operacao: 'Mapa de lideranças', finalidade: 'Visualizar presença territorial', baseLegal: base, dados: 'Posição aproximada (deslocamento de ~200 m); endereço exato nunca exibido no mapa', titulares: 'Apoiadores', compartilhamento: 'Nenhum', retencao, seguranca: SEC },
      { operacao: 'Registro de consentimento', finalidade: 'Comprovar a autorização do titular', baseLegal: 'Cumprimento de obrigação legal (LGPD art. 7º, II)', dados: 'Data, canal, finalidade, texto aceito, coletor', titulares: 'Apoiadores', compartilhamento: 'Nenhum', retencao: 'Enquanto durar a campanha e o prazo de prova', seguranca: SEC },
      { operacao: 'Descadastro', finalidade: 'Atender pedido de remoção do titular', baseLegal: 'Direito do titular (LGPD art. 18)', dados: 'Hash do identificador, data e motivo (sem dados pessoais)', titulares: 'Apoiadores', compartilhamento: 'Nenhum', retencao: 'Registro mínimo mantido como prova', seguranca: SEC },
    ];
    return {
      campaign: campaign.name,
      generatedAt: new Date().toISOString(),
      dpo: { name: campaign.dpoName, email: campaign.dpoEmail, contact: campaign.dpoContact },
      stats: { supporters, withActiveConsent: withConsent, removals },
      rows,
    };
  }

  async csv() {
    const r = await this.build();
    const cols: (keyof RopaRow)[] = ['operacao', 'finalidade', 'baseLegal', 'dados', 'titulares', 'compartilhamento', 'retencao', 'seguranca'];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = ['Operação', 'Finalidade', 'Base legal', 'Dados tratados', 'Titulares', 'Compartilhamento', 'Retenção', 'Segurança'].map(esc).join(';');
    return '﻿' + [head, ...r.rows.map((row) => cols.map((c) => esc(row[c])).join(';'))].join('\n');
  }

  async pdf(): Promise<Buffer> {
    const r = await this.build();
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(chunks))));
    doc.fontSize(18).text('Registro das Operações de Tratamento');
    doc.fontSize(10).fillColor('#555').text(`${r.campaign} · gerado em ${new Date(r.generatedAt).toLocaleString('pt-BR')}`).moveDown();
    doc.fillColor('#000').text(`Encarregado (DPO): ${r.dpo.name ?? 'não informado'} ${r.dpo.email ? `<${r.dpo.email}>` : ''}`);
    doc.text(`Apoiadores ativos: ${r.stats.supporters} · com consentimento ativo: ${r.stats.withActiveConsent} · descadastros: ${r.stats.removals}`).moveDown();
    for (const row of r.rows) {
      doc.fontSize(12).text(row.operacao, { underline: true });
      doc.fontSize(9);
      for (const [k, v] of Object.entries(row).slice(1)) doc.text(`${k}: ${v}`);
      doc.moveDown();
    }
    doc.fontSize(8).fillColor('#555').text('Este documento é um modelo de organização e não substitui orientação jurídica eleitoral.');
    doc.end();
    return done;
  }
}
