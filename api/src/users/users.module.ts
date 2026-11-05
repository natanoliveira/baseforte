import { Module } from '@nestjs/common';
import { PlanLimitService } from './plan-limit.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PlanLimitService],
  exports: [PlanLimitService],
})
export class UsersModule {}
