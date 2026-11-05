import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../common/public.decorator';
import { AnyRole } from '../common/roles.decorator';
import { TenantUser } from '../tenancy/tenant-context';
import { LoginDto } from './auth.dto';
import { AuthService } from './auth.service';

const secure = () => process.env.NODE_ENV === 'production';

function setCookies(res: Response, t: { accessToken: string; refreshToken: string }) {
  const base = { httpOnly: true, sameSite: 'lax' as const, secure: secure() };
  res.cookie('access_token', t.accessToken, { ...base, path: '/', maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', t.refreshToken, { ...base, path: '/api/v1/auth', maxAge: 7 * 24 * 3600 * 1000 });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('login') @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    setCookies(res, await this.auth.login(dto.email, dto.password));
    return { ok: true };
  }

  @Public() @Post('refresh') @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    setCookies(res, await this.auth.refresh(req.cookies?.refresh_token));
    return { ok: true };
  }

  @AnyRole() @Post('logout') @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout((req as any).user.sub);
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    return { ok: true };
  }

  @AnyRole() @Get('me')
  me(@Req() req: Request) {
    return this.auth.me(((req as any).user as TenantUser).sub);
  }
}
