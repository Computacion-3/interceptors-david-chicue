import * as crypto from 'crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';

import { AppLogger } from '../logger/logger.service';
import { TracedRequest } from '../interfaces/traced-request.interface';

// Solo se aceptan IDs "seguros": letras, números, guion y guion bajo (máx. 64 caracteres)
const VALID_CORRELATION_ID = /^[\w-]{1,64}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
    use(request: TracedRequest, response: Response, next: NextFunction): void {
        const header = request.headers['x-correlation-id'];
        const incoming = Array.isArray(header) ? header[0] : header;
        const correlationId = incoming && VALID_CORRELATION_ID.test(incoming) ? incoming : crypto.randomUUID();

        request.correlationId = correlationId;
        response.setHeader('x-correlation-id', correlationId);

        // Todo lo que se ejecute a partir de aquí (guards, pipes, servicios) comparte este contexto
        AppLogger.runWithCorrelationId(correlationId, next);
    }
}
