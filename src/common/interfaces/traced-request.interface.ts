import { Request } from 'express';

export interface TracedRequest extends Request {
    correlationId: string;
}
