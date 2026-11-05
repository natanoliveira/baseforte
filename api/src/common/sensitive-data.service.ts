import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../tenancy/prisma.service';

/** Único ponto que cifra/decifra (RN-15). Nunca chamar em listagens ou mapa. */
@Injectable()
export class SensitiveDataService {
  private readonly key = process.env.APP_ENC_KEY as string;
  constructor(private readonly prisma: PrismaService) {}

  async encrypt(plain: string): Promise<Buffer> {
    const [r] = await this.prisma.$queryRaw<{ v: Buffer }[]>(Prisma.sql`SELECT pgp_sym_encrypt(${plain}, ${this.key}) AS v`);
    return Buffer.from(r.v);
  }

  async decrypt(cipher: Buffer | Uint8Array | null | undefined): Promise<string | null> {
    if (!cipher) return null;
    const [r] = await this.prisma.$queryRaw<{ v: string }[]>(
      Prisma.sql`SELECT pgp_sym_decrypt(${Buffer.from(cipher)}::bytea, ${this.key}) AS v`,
    );
    return r.v;
  }
}
