import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@Roles('CANDIDATO', 'COORD_GERAL')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() list(@Query() q: { page?: string; pageSize?: string }) { return this.users.list(q); }
  @Post() create(@Body() dto: CreateUserDto) { return this.users.create(dto); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) { return this.users.update(id, dto); }
}
