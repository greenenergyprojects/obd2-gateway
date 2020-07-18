import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('odb2:serial:usb');

import * as events from 'events';
import * as fs from 'fs';
import path	= require('path');

import * as SerialPort from 'serialport';
import { SerialBase, SerialInterface } from './serial-base';

export class Usb extends SerialBase {

    private _serialPort: SerialPort;

    // private static prepareOpenOptions (options?: SerialPort.OpenOptions): SerialPort.OpenOptions {
    //     const rv = Object.create( {}, <any>options);
    //     rv.autoOpen = false;
    //     return rv;
    // }

    public constructor ( device: string, options: SerialPort.OpenOptions ) {
        super();
        const opt = Object.assign( {}, <any>options);
        opt.autoOpen = false;
        this._serialPort = new SerialPort(device, opt, (err?: Error | null) => {
            if (err) {
                debug.warn('creating instance of USB fails\n%e', err);
                this._serialPort = null;
            }
        });
        this._serialPort.on( 'open', (data) => {
            debug.fine('serial port %s opened', this._serialPort.path);
            this.emit('open');
        });
        this._serialPort.on( 'close', (data) => {
            debug.fine('serial port %s closed', this._serialPort.path);
            this.emit('close');
        });
        this._serialPort.on( 'error', (err: Error) => {
            debug.fine('serial port %s error\n%e', this._serialPort.path, err);
            this.emit('error', err);
        });
        this._serialPort.on( 'data', (data: any) => {
            this.emit('data', data);
            debug.fine('usb receive data: %o', data);
            this.processResponseData(data);
        });

    }


    public async connect (): Promise<void> {
        return new Promise<void>( (res, rej) => {
            this._serialPort.open( (err?: Error | null) => {
                if (err) {
                    rej(err);
                } else {
                    res();
                }
            });
        });
    }


    public async disconnect (): Promise<void> {
        return new Promise<void>( (res, rej) => {
            this._serialPort.close( (err?: Error | null) => {
                if (err) {
                    rej(err);
                } else {
                    res();
                }
            });
        });
    }


    public isOpen (): boolean {
        return this._serialPort.isOpen === true;
    }

    public write (data: string | Buffer | Uint8Array, encoding?: string): Promise<boolean> {
        return new Promise<boolean>( (res, rej) => {
            if (data instanceof Uint8Array) {
                const b = Buffer.from(data);
                debug.fine('usb write data: %o', data);
                const rv = this._serialPort.write(b, (err, bytesWritten) => {
                    if (err) {
                        rej(err);
                    }
                });
                res(rv);
            } else {
                debug.fine('usb write data: %o', data);
                const rv = this._serialPort.write(data, (err, bytesWritten) => {
                    if (err) {
                        rej(err);
                    }
                });
                res(rv);
            }
        });
    }

}

