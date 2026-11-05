import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Min, MinLength, ValidateIf } from 'class-validator';

const STATUS = ['ATIVO', 'FRIO', 'INATIVO'] as const;

export class CreateLeaderDto {
  @IsString() @MinLength(2) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() phone?: string;
  @IsUUID() neighborhoodId!: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsUUID() coordinatorId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) zones?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) sections?: string[];
  @IsOptional() @IsInt() @Min(0) goal?: number;
}

export class UpdateLeaderDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsUUID() neighborhoodId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) zones?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) sections?: string[];
  @IsOptional() @IsInt() @Min(0) goal?: number;
  @ValidateIf((_, v) => v !== null) @IsOptional() @IsIn(STATUS) statusOverride?: (typeof STATUS)[number] | null;
}

export class ListLeadersQuery {
  @IsOptional() page?: string;
  @IsOptional() pageSize?: string;
  @IsOptional() @IsUUID() neighborhoodId?: string;
  @IsOptional() @IsUUID() coordinatorId?: string;
  @IsOptional() @IsIn(STATUS) status?: (typeof STATUS)[number];
  @IsOptional() @Type(() => Number) @IsInt() goalMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() goalMax?: number;
}
