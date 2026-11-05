import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export const CREATABLE_ROLES = ['COORD_GERAL', 'COORD_REGIAO', 'AUDITOR'] as const;

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(8) password!: string;
  @IsIn(CREATABLE_ROLES) role!: (typeof CREATABLE_ROLES)[number];
  @IsOptional() @IsUUID() regionId?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsUUID() regionId?: string;
}
