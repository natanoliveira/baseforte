import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { LeadersController } from './leaders.controller';
import { LeadersService } from './leaders.service';
import { RankingService } from './ranking.service';
import { TreeController } from './tree.controller';
import { TreeService } from './tree.service';

@Module({ imports: [UsersModule], controllers: [TreeController, LeadersController], providers: [LeadersService, TreeService, RankingService], exports: [LeadersService] })
export class LeadersModule {}
