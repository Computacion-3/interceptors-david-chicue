import { STATUS_CODES } from 'http';

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
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

        const startTime = Date.now();
        const { method, originalUrl, correlationId } = request;
        let statusCode: number | undefined;

        return next.handle().pipe(
            // Solo captura el status en caso de error; no altera el payload
            tap({
                error: (error: unknown) => {
                    statusCode = error instanceof HttpException ? error.getStatus() : 500;
                },
            }),
            // finalize se ejecuta siempre (éxito, error o cliente desconectado)
            finalize(() => {
                const status = statusCode ?? response.statusCode;
                const duration = Date.now() - startTime;
                const line = `[TRACE] [${method} ${originalUrl}] [${status} ${STATUS_CODES[status] ?? ''}] [Duration: ${duration}ms] [CorrelationID: ${correlationId}]`;

                if (status >= 400) {
                    this.logger.error(line);
                } else {
                    this.logger.log(line);
                }
            }),
        );
    }
}
