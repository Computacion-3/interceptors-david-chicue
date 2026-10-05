import * as fs from 'fs';
import * as path from 'path';
import { AsyncLocalStorage } from 'async_hooks';

import { Injectable, LoggerService, OnModuleDestroy } from '@nestjs/common';

interface TraceContext {
    correlationId: string;
}

@Injectable()
export class AppLogger implements LoggerService, OnModuleDestroy {
    private static readonly storage = new AsyncLocalStorage<TraceContext>();
    private logStream: fs.WriteStream;

    constructor() {
        const dateStamp = new Date().toISOString().split('T')[0];
        const logDir = path.join(process.cwd(), 'logs');

        // Garantiza la existencia del directorio de almacenamiento
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const logFile = path.join(logDir, `app-${dateStamp}.log`);
        // Abre el stream en modo append ('a')
        this.logStream = fs.createWriteStream(logFile, { flags: 'a' });
    }

    // Asocia el correlation ID al resto de la cadena asíncrona de la petición actual
    static setCorrelationId(correlationId: string): void {
        AppLogger.storage.enterWith({ correlationId });
    }

    static getCorrelationId(): string | undefined {
        return AppLogger.storage.getStore()?.correlationId;
    }

    // Registro explícito con un correlation ID dado (no depende del contexto asíncrono)
    logWithTrace(correlationId: string, level: string, message: string): void {
        this.write(level.toUpperCase(), message, undefined, correlationId);
    }

    log(message: string) {
        this.write('LOG', message);
    }

    error(message: string, trace?: string) {
        this.write('ERROR', message, trace);
    }

    warn(message: string) {
        this.write('WARN', message);
    }

    debug(message: string) {
        this.write('DEBUG', message);
    }

    verbose(message: string) {
        this.write('VERBOSE', message);
    }

    private write(level: string, message: string, trace?: string, correlationId?: string) {
        const timestamp = new Date().toISOString();
        const cid = correlationId ?? AppLogger.getCorrelationId();
        const cidTag = cid && !message.includes(`[CorrelationID: ${cid}]`) ? ` [CorrelationID: ${cid}]` : '';
        const formattedLog = `[${timestamp}] [${level}]${cidTag} ${message}${trace ? '\n[Stack Trace]: ' + trace : ''}\n`;

        // Escritura persistente en disco
        this.logStream.write(formattedLog);

        // Salida formateada en consola
        console.info(formattedLog.trim());
    }

    onModuleDestroy() {
        if (this.logStream) {
            this.logStream.end();
        }
    }
}
