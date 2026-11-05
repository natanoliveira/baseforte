import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../tenancy/prisma.service';
import { Page, parsePage, toPage } from '../common/pagination';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { PlanLimitService } from './plan-limit.service';

const select = { id: true, name: true, email: true, role: true, regionId: true, createdAt: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly limits: PlanLimitService) {}

  async list(q: { page?: string; pageSize?: string }): Promise<Page<any>> {
    const { page, pageSize, skip, take } = parsePage(q);
    const [data, total] = await Promise.all([
      this.prisma.tenant.user.findMany({ select, orderBy: { name: 'asc' }, skip, take }),
      this.prisma.tenant.user.count(),
    ]);
    return toPage(data, total, page, pageSize);
  }

  private async assertRegion(regionId?: string) {
    if (regionId && !(await this.prisma.tenant.region.findFirst({ where: { id: regionId } }))) {
      throw new UnprocessableEntityException('Região inválida');
    }
  }

  async create(dto: CreateUserDto) {
    if (dto.role === 'COORD_REGIAO' && !dto.regionId) throw new UnprocessableEntityException('Coordenador de região exige regionId');
    await this.assertRegion(dto.regionId);
    await this.limits.assertCanCreateUser();
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('E-mail já cadastrado');
    return this.prisma.tenant.user.create({
      data: { email, name: dto.name, role: dto.role, regionId: dto.regionId, passwordHash: await argon2.hash(dto.password) } as any,
      select,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    if (!(await this.prisma.tenant.user.findFirst({ where: { id } }))) throw new NotFoundException();
    await this.assertRegion(dto.regionId);
    const { password, ...rest } = dto;
    return this.prisma.tenant.user.update({
      where: { id },
      data: { ...rest, ...(password && { passwordHash: await argon2.hash(password) }) },
      select,
    });
  }
}
