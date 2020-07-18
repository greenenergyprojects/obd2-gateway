
import { Request, Response, NextFunction } from 'express';
import { Server } from '../server';

import { ISimpleLogger } from 'debug-sx';



export class RouterError extends Error {

    private _statusCode: number;
    private _cause: Error;

    constructor (msg: string, statusCode: number, cause?: Error) {
        super(msg);
        this._statusCode = statusCode;
        this._cause = cause;
    }

    public get statusCode (): number {
        return this._statusCode;
    }

    public get cause (): Error {
        return this._cause;
    }

}

export class BadRequestError extends RouterError {
    constructor (msg: string, cause?: Error) {
        super(msg, 400, cause);
    }
}

export class AuthenticationError extends RouterError {
    constructor (msg: string, cause?: Error) {
        super(msg, 401, cause);
    }
}

export class NotFoundError extends RouterError {
    constructor (msg: string, cause?: Error) {
        super(msg, 404, cause);
    }
}

export function handleError (err: Error,  req: Request, res: Response, next: NextFunction, debug: ISimpleLogger) {
    if (!err) {
        throw new Error('invalid argument');
    }
    if (!(err instanceof RouterError)) {
        next(err);
        return;
    }

    const now = new Date();
    const ts = now.toISOString();
    const status = err.statusCode;
    let msg = err.message || '';
    msg = ' - ' + msg;
    switch (status) {
        case 400: msg = 'Bad Request (400)' + msg; break;
        case 401: msg = 'Bad Authentication (401)' + msg; break;
        case 404: msg = 'Not Found (404)' + msg; break;
        default: msg = '? (' + status + ')' + msg; break;
    }
    if (req.url.endsWith('/auth') && req.body.password) {
        const pw = req.body.password;
        req.body.password = pw[0] + new Array(pw.length - 1).join('*');
    }
    if (err.cause) {
        debug.info('%s\n  %s\n  %s %s\n%o\n%e', msg, ts, req.method, req.originalUrl, req.body, err.cause);
    } else {
        debug.info('%s\n  %s\n  %s %s\n%o', msg, ts, req.method, req.originalUrl, req.body);
    }
    if (status === 401) {
        const authServerUri = ''; //Auth.Instance.authServerUri;
        if (authServerUri) {
            const v = 'Bearer authorization_uri="' + authServerUri +
                      '", error="' + 'Unauthorized' + '", error_description="' + 'contact web-master with ' + ts + '"';
            res.setHeader('WWW-Authenticate', v);
        }
    }

    if (req.headers.accept && req.headers.accept.indexOf('application/json') >= 0) {
        switch (status) {
            case 400: res.status(400).json({ error: 'Bad Request', ts: ts}); break;
            case 401: res.status(401).json({ error: 'Unauthorized', ts: ts}); break;
            case 404: res.status(404).json({ error: 'Not Found', ts: ts}); break;
            default: next(err);
        }
    } else {
        switch (status) {
            case 400: res.status(400).render('error400.pug', { time: ts }); break;
            case 401: res.status(401).render('error401.pug', { time: ts }); break;
            case 404: res.status(404).render('error404.pug', { time: ts }); break;
            default: next(err);
        }
    }
}

