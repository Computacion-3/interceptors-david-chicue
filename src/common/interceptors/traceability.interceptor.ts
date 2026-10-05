import * as crypto from 'crypto';
import { STATUS_CODES } from 'http';

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';

import { AppLogger } from '../logger/logger.service';
import { TracedRequest } from '../interfaces/traced-request.interface';

@Injectable()
export class TraceabilityInterceptor implements NestInterceptor {
    constructor(private readonly logger: AppLogger) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const http = context.switchToHttp();
        const request = http.getRequest<TracedRequest>();
        const response = http.getResponse<Response>();

        const header = request.headers['x-correlation-id'];
        const incoming = Array.isArray(header) ? header[0] : header;
        const correlationId = incoming || crypto.randomUUID();

        request.correlationId = correlationId;
        response.setHeader('x-correlation-id', correlationId);
        AppLogger.setCorrelationId(correlationId);

        const startTime = Date.now();
        const { method, originalUrl } = request;

        const trace = (statusCode: number, level: 'log' | 'error') => {
            const duration = Date.now() - startTime;
            const statusText = STATUS_CODES[statusCode] ?? '';
            const line = `[TRACE] [${method} ${originalUrl}] [${statusCode} ${statusText}] [Duration: ${duration}ms] [CorrelationID: ${correlationId}]`;
            if (level === 'error') {
                this.logger.error(line);
            } else {
                this.logger.log(line);
            }
        };

        return next.handle().pipe(
            tap({
                next: () => trace(response.statusCode, 'log'),
                error: (error: unknown) => trace(error instanceof HttpException ? error.getStatus() : 500, 'error'),
            }),
        );
    }
}
