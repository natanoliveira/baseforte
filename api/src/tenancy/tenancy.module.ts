import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { PrismaService } from './prisma.service';
import { ScopeService } from './scope.service';
import { TenantGuard } from './tenant.guard';

@Global()
@Module({
  imports: [ClsModule.forRoot({ global: true, middleware: { mount: true } })],
  providers: [PrismaService, TenantGuard, ScopeService],
  exports: [PrismaService, TenantGuard, ScopeService],
})
export class TenancyModule {}
