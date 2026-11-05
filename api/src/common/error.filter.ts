import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

const CODES: Record<number, string> = {
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION',
};

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (!(exception instanceof HttpException)) {
      return res.status(500).json({ statusCode: 500, code: 'INTERNAL', message: 'Erro interno' });
    }
    const status = exception.getStatus();
    const body = exception.getResponse() as any;
    const message = typeof body === 'string' ? body : body.message ?? exception.message;
    const code = (typeof body === 'object' && body.code) || CODES[status] || 'ERROR';
    const details = Array.isArray(message) ? message : undefined;
    res.status(status === HttpStatus.BAD_REQUEST && details ? 422 : status).json({
      statusCode: status === HttpStatus.BAD_REQUEST && details ? 422 : status,
      code: status === HttpStatus.BAD_REQUEST && details ? 'VALIDATION' : code,
      message: details ? 'Dados inválidos' : message,
      ...(details && { details }),
    });
  }
}
