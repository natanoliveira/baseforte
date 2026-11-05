import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { MapService } from './map.service';

/** Relatório do bairro em PDF: só agregados e nomes de liderança, nenhum dado pessoal de apoiador (RF-16). */
@Injectable()
export class ReportService {
  constructor(private readonly map: MapService) {}

  async neighborhoodPdf(id: string): Promise<Buffer> {
    const p = await this.map.panel(id);
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(chunks))));
    doc.fontSize(20).text(`Bairro ${p.neighborhood.name}`);
    doc.fontSize(9).fillColor('#555').text(`Gerado em ${new Date().toLocaleString('pt-BR')}`).moveDown();
    doc.fillColor('#000').fontSize(12)
      .text(`Apoiadores: ${p.supporters}   Meta: ${p.goal}   Atingido: ${p.pct == null ? 'sem meta' : `${p.pct}%`}`).moveDown();
    doc.fontSize(14).text('Lideranças');
    doc.fontSize(10);
    if (!p.leaders.length) doc.text('Nenhuma liderança neste bairro (bairro vazio).');
    for (const l of p.leaders) doc.text(`${l.name} · ${l.status} · ${l.supporters}/${l.goal} apoiadores`);
    doc.moveDown().fontSize(14).text('Lacunas');
    doc.fontSize(10).text(p.gaps.noLeaders ? 'Sem nenhuma liderança.' : p.gaps.belowGoal ? 'Abaixo da meta.' : 'Meta atingida.');
    doc.moveDown().fontSize(14).text('Locais de votação');
    doc.fontSize(10);
    if (!p.votingPlaces.length) doc.text('Nenhum cadastrado.');
    for (const v of p.votingPlaces) doc.text(v.name);
    doc.moveDown().fontSize(8).fillColor('#555').text('Posições de apoiadores são sempre aproximadas. Este relatório não substitui orientação jurídica eleitoral.');
    doc.end();
    return done;
  }
}
