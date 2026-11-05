import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateDpoDto {
  @IsString() @MinLength(2) dpoName!: string;
  @IsEmail() dpoEmail!: string;
  @IsOptional() @IsString() dpoContact?: string;
}
