import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
import { Prisma, PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHmac, randomUUID } from 'crypto';
import * as fs from 'fs';
import { jitterPoint } from '../src/common/jitter';

// Dados 100% fictícios (RN-01). Determinístico: mesma seed, mesmo resultado.
const prisma = new PrismaClient();
const KEY = process.env.APP_ENC_KEY as string;
const SLUG = 'candidato-exemplo';
const PASSWORD = process.env.SEED_PASSWORD || 'demo1234';
const DAY = 86_400_000;

let s = 20260101;
const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gisele', 'Hugo', 'Isabela', 'João', 'Karina', 'Lucas', 'Marta', 'Nilton', 'Olívia', 'Paulo', 'Quênia', 'Rafael', 'Sara', 'Tiago', 'Úrsula', 'Valter', 'Wanda', 'Xavier', 'Yara', 'Zeca'];
const LAST = ['Almeida', 'Barros', 'Cardoso', 'Dantas', 'Esteves', 'Furtado', 'Gomes', 'Holanda', 'Ibiapina', 'Junqueira', 'Lima', 'Macedo', 'Nunes', 'Oliveira', 'Pinheiro', 'Queiroz', 'Rocha', 'Sampaio', 'Teixeira', 'Uchoa'];
const name = () => `${pick(FIRST)} ${pick(LAST)} ${pick(LAST)}`;
const enc = (v: string) => Prisma.sql`pgp_sym_encrypt(${v}, ${KEY})`;
const hmac = (v: string) => createHmac('sha256', KEY).update(v).digest('hex');

async function wipe(campaignId: string) {
  await prisma.accessLog.deleteMany({ where: { campaignId } });
  await prisma.removalRecord.deleteMany({ where: { campaignId } });
  await prisma.consent.deleteMany({ where: { campaignId } });
  await prisma.supporter.deleteMany({ where: { campaignId } });
  await prisma.leader.updateMany({ where: { campaignId }, data: { parentId: null } });
  await prisma.leader.deleteMany({ where: { campaignId } });
  await prisma.votingPlace.deleteMany({ where: { campaignId } });
  await prisma.neighborhood.deleteMany({ where: { campaignId } });
  await prisma.user.deleteMany({ where: { campaignId } });
  await prisma.region.deleteMany({ where: { campaignId } });
  await prisma.campaign.delete({ where: { id: campaignId } });
}

async function main() {
  const old = await prisma.campaign.findUnique({ where: { slug: SLUG } });
  if (old) await wipe(old.id);

  const campaign = await prisma.campaign.create({
    data: {
      slug: SLUG, name: 'Candidato(a) Exemplo — Vereador(a) — Teresina-PI', plan: 'VEREADOR',
      dpoName: 'Encarregado(a) Exemplo', dpoEmail: 'dpo@exemplo.test', dpoContact: 'Atendimento ao titular: dpo@exemplo.test',
    },
  });
  const campaignId = campaign.id;
  const passwordHash = await argon2.hash(PASSWORD);

  // Regiões e bairros (polígonos ilustrativos)
  const geo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'neighborhoods.geojson'), 'utf8'));
  const regionNames = ['Norte', 'Sul', 'Leste', 'Oeste'];
  const regionId: Record<string, string> = {};
  for (const r of regionNames) regionId[r] = (await prisma.region.create({ data: { campaignId, name: r } })).id;

  const nb: { id: string; name: string; region: string; cx: number; cy: number; w: number; h: number }[] = [];
  for (const f of geo.features) {
    const ring: number[][] = f.geometry.coordinates[0];
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Neighborhood" (id, "campaignId", "regionId", name, geom, centroid)
      VALUES (${id}, ${campaignId}, ${regionId[f.properties.region]}, ${f.properties.name},
        ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(f.geometry)}), 4326)),
        ST_SetSRID(ST_MakePoint(${(x0 + x1) / 2}, ${(y0 + y1) / 2}), 4326))`;
    nb.push({ id, name: f.properties.name, region: f.properties.region, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 });
  }

  const places = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'voting-places.json'), 'utf8'));
  for (const p of places) {
    const n = nb.find((x) => x.name === p.neighborhood)!;
    await prisma.$executeRaw`INSERT INTO "VotingPlace" (id, "campaignId", "neighborhoodId", name, location)
      VALUES (${randomUUID()}, ${campaignId}, ${n.id}, ${p.name}, ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326))`;
  }

  // Usuários de equipe
  const mkUser = (email: string, role: any, nm: string, extra: any = {}) =>
    prisma.user.create({ data: { campaignId, email, role, name: nm, passwordHash, ...extra } });
  await mkUser('candidato@exemplo.test', 'CANDIDATO', 'Candidato(a) Exemplo');
  await mkUser('coordenacao@exemplo.test', 'COORD_GERAL', 'Coordenação Geral Exemplo');
  await mkUser('auditor@exemplo.test', 'AUDITOR', 'Auditor(a) LGPD Exemplo');
  const coord: Record<string, string> = {};
  for (const r of regionNames) coord[r] = (await mkUser(`coord-${r.toLowerCase()}@exemplo.test`, 'COORD_REGIAO', `Coord. ${r}`, { regionId: regionId[r] })).id;

  // 3 bairros vazios (um por região distinta) e 2 acima da meta
  const empty = new Set(['Ilhotas', 'Pedra Mole', 'Água Mineral']);
  const above = new Set(['Centro', 'Jóquei']);
  const withLeaders = nb.filter((n) => !empty.has(n.name));

  // 40 lideranças
  const leaders: { id: string; nb: (typeof nb)[number]; goal: number; email: string }[] = [];
  for (let i = 0; i < 40; i++) {
    const n = withLeaders[i % withLeaders.length];
    const goal = int(40, 60);
    const lastDays = i % 5 === 0 ? int(0, 6) : i % 5 === 1 ? int(16, 40) : i % 5 === 2 ? int(50, 90) : int(0, 13);
    const email = `lideranca${String(i + 1).padStart(2, '0')}@exemplo.test`;
    const nm = name();
    const u = await mkUser(email, 'LIDERANCA', nm);
    const parentCandidate = leaders.find((l) => l.nb.region === n.region && i >= 32);
    const l = await prisma.leader.create({
      data: {
        campaignId, userId: u.id, name: nm, neighborhoodId: n.id, goal,
        coordinatorId: parentCandidate ? null : coord[n.region], parentId: parentCandidate?.id ?? null,
        zones: [`ZE ${int(1, 3)}`], sections: [String(int(10, 400))],
        lastActivityAt: new Date(Date.now() - lastDays * DAY),
      },
    });
    await prisma.$executeRaw`UPDATE "Leader" SET "phoneEnc" = ${enc(`(86) 90000-${String(int(0, 9999)).padStart(4, '0')}`)} WHERE id = ${l.id}`;
    leaders.push({ id: l.id, nb: n, goal, email });
  }

  // ~1.500 apoiadores, todos com consentimento
  const adminId = (await prisma.user.findFirstOrThrow({ where: { campaignId, role: 'CANDIDATO' } })).id;
  const consents: Prisma.ConsentCreateManyInput[] = [];
  let seq = 0;
  const ratioOf = new Map<string, number>(nb.map((n) => [n.id, above.has(n.name) ? 1.25 : 0.4 + rnd() * 0.5]));
  for (const l of leaders) {
    const count = Math.round(l.goal * ratioOf.get(l.nb.id)!);
    for (let k = 0; k < count; k++) {
      const id = randomUUID(), jitterSeed = int(1, 2_000_000_000);
      const lng = l.nb.cx + (rnd() - 0.5) * l.nb.w * 0.9, lat = l.nb.cy + (rnd() - 0.5) * l.nb.h * 0.9;
      const j = jitterPoint(lat, lng, jitterSeed);
      const phone = `(86) 90000-${String(seq++ % 10000).padStart(4, '0')}`;
      const createdAt = new Date(Date.now() - int(0, 60) * DAY);
      await prisma.$executeRaw`
        INSERT INTO "Supporter" (id, "campaignId", "leaderId", "neighborhoodId", name, "phoneEnc", "phoneHash", "addressEnc", "locationEnc",
          "mapPoint", "jitterSeed", "geocodeStatus", "removalToken", "createdAt")
        VALUES (${id}, ${campaignId}, ${l.id}, ${l.nb.id}, ${name()}, ${enc(phone)}, ${hmac(phone.replace(/\D/g, ''))},
          ${enc(`Rua Exemplo ${int(1, 999)}, ${l.nb.name}`)}, ${enc(JSON.stringify({ lat, lng }))},
          ST_SetSRID(ST_MakePoint(${j.lng}, ${j.lat}), 4326), ${jitterSeed}, 'OK', ${randomUUID()}, ${createdAt})`;
      consents.push({
        campaignId, supporterId: id, grantedAt: createdAt, channel: pick(['presencial', 'evento', 'formulário']),
        purpose: 'comunicacao-campanha', textVersion: 'v1',
        textAccepted: 'Autorizo o uso do meu contato para comunicação sobre esta campanha.', collectedById: adminId,
      });
    }
  }
  await prisma.consent.createMany({ data: consents });

  console.log(`Seed ok: ${leaders.length} lideranças, ${consents.length} apoiadores. Logins em @exemplo.test (senha: SEED_PASSWORD ou padrão do README).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
