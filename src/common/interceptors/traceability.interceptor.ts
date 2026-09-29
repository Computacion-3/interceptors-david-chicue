import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as crypto from 'crypto';
import { Request, Response } from 'express';

@Injectable()
export class TraceabilityInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Traceability');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const correlationId =
      (request.headers['x-correlation-id'] as string) || crypto.randomUUID();

    request['correlationId'] = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    const startTime = Date.now();
    const { method, url } = request;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        
        this.logger.log(
          `[TRACE] [${method} ${url}] [${statusCode} OK] [Duration: ${duration}ms] [CorrelationID: ${correlationId}]`,
        );
      }),
    );
  }
}
