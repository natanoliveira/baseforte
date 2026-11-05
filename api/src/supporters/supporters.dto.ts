import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';

export class ConsentInputDto {
  @IsString() @MinLength(1) channel!: string;
  @IsString() @MinLength(1) purpose!: string;
  @IsString() @MinLength(1) textVersion!: string;
  @IsString() @MinLength(10) textAccepted!: string;
}

class LocationFields {
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() @IsLatitude() lat?: number;
  @IsOptional() @IsNumber() @IsLongitude() lng?: number;
}

export class CreateSupporterDto extends LocationFields {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsUUID() neighborhoodId!: string;
  @IsOptional() @IsUUID() leaderId?: string;
  // Opcional no DTO para o service responder CONSENT_REQUIRED (CA-11).
  @IsOptional() @ValidateNested() @Type(() => ConsentInputDto) consent?: ConsentInputDto;
}

export class UpdateSupporterDto extends LocationFields {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsUUID() neighborhoodId?: string;
}

export class ListSupportersQuery {
  @IsOptional() page?: string;
  @IsOptional() pageSize?: string;
  @IsOptional() @IsUUID() leaderId?: string;
  @IsOptional() @IsUUID() neighborhoodId?: string;
  @IsOptional() @IsString() q?: string;
}
