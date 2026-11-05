import { IsOptional, IsString, MinLength } from 'class-validator';

export class CorrectDataDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @MinLength(8) phone?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() @MinLength(3) address?: string;
}
