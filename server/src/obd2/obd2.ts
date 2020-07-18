import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('obd2');

export interface IOBD2Config {
    device: 'elm327';
    type: 'sim' | 'bluetooth' | 'wlan' | 'usb';
    timeoutMillis: number;
    serialPort?: {
        device:   string;
        options?: {
            baudRate: number;
        }
    };
}

import * as nconf from 'nconf';
import { SerialBase } from './serial/serial-base';
import { Usb } from './serial/usb';
import { Sim } from './serial/sim';
import { sprintf } from 'sprintf-js';

export class OBD2 {

    public static async createInstance (config?: IOBD2Config): Promise<OBD2> {
        if (OBD2._instance !== undefined) { throw new Error('instance already created'); }
        OBD2._instance = new OBD2(config);
        await OBD2._instance.init();
        return OBD2._instance;
    }

    public static getInstance (): OBD2 {
        if (OBD2._instance === undefined) { throw new Error('no instance'); }
        return OBD2._instance;
    }

    private static _instance: OBD2;

    // ****************************************************************************

    private _config: IOBD2Config;
    private _serial: SerialBase;
    private _cancel = false;
    private _status: IObd2Status = { connected: false, status: [] };

    constructor (config?: IOBD2Config) {
        config = config || nconf.get('obd2');
        if (!config) { throw new Error('missing/invalid config'); }
        if (config.device !== 'elm327') { throw new Error('missing/invalid config.interface'); }
        if (!(config.timeoutMillis > 0)) { throw new Error('missing/invalid config.timeoutMilis'); }
        if (typeof config.type !== 'string') { throw new Error('missing/invalid config.type'); }
        this._config = config;
    }

    public async shutdown (): Promise<void> {
        this._cancel = true;
        if (this._serial && this._serial.isOpen()) {
            await this._serial.disconnect();
        }
    }

    public getStatus (): IObd2Status {
        return this._status;
    }

    public async start (): Promise<void> {
        if (this._cancel) {
            throw new Error('Cancelled');
        }
        this._serial.clearResponse();
        await this._serial.write('AT D\r\n');
        try { await this._serial.readResponse(1000); } catch (err) { debug.warn('Timeout'); }

        this._serial.clearResponse();
        await this._serial.write('AT Z\r\n');
        try { await this._serial.readResponse(1000); } catch (err) { debug.warn('Timeout'); }

        this._serial.clearResponse();
        await this._serial.write('AT E0\r\n');
        try { await this._serial.readResponse(1000); } catch (err) { debug.warn('Timeout'); }

        this._serial.clearResponse();
        await this._serial.write('AT S0\r\n');
        try { await this._serial.readResponse(1000); } catch (err) { debug.warn('Timeout'); }

        this._serial.clearResponse();
        await this._serial.write('AT H1\r\n');
        try { await this._serial.readResponse(1000); } catch (err) { debug.warn('Timeout'); }

        this._serial.clearResponse();
        await this._serial.write('AT RV\r\n');
        try { await this._serial.readResponse(1000); } catch (err) { debug.warn('Timeout'); }

        let lastResponseAt = Date.now();

        while (true) {

            if (this._status.status.length > 0) {
                this._status.status.splice(0, 1);
            }

            try {
                this._status.lastRefresh = new Date().toLocaleTimeString();
                if (lastResponseAt < (Date.now() - 30000)) {
                    this._status.connected = false;
                } else {
                    this._status.connected = true;
                }

                if (this._cancel) { return; }
                this._serial.clearResponse();
                await this._serial.write('0100\r\n');
                try {
                    const resp = await this._serial.readResponse(15000);
                    debug.fine('0100 -> response: %s', resp.replace(/(?:\r)/g, '\\r').replace(/(?:\n)/g, '\\n'));
                    const i = resp.startsWith('7EC') ? 0 : resp.indexOf('\r7EC', 0);
                    if (i < 0) {
                        debug.warn('invalid response for 0100: %s', resp.replace(/(?:\r)/g, '\\r').replace(/(?:\n)/g, '\\n'));
                        this.addStatusMessage('0100: Err1');
                    } else {
                        // this.addStatusMessage('0100: OK');
                        debug.fine('response for 0100: %s', resp.replace(/(?:\r)/g, '\\r').replace(/(?:\n)/g, '\\n'));
                    }
                    lastResponseAt = Date.now();
                } catch (err) {
                    const rv = this._serial.clearResponse().replace(/(?:\r)/g, '\\r').replace(/(?:\n)/g, '\\n');
                    debug.warn('error -> uncomplete response for 0100: %s', rv);
                    this.addStatusMessage('0100: Err2');
                }

                if (this._cancel) { return; }
                this._serial.clearResponse();
                await this._serial.write('2101\r\n');
                try {
                    const resp = await this._serial.readResponse(15000);
                    debug.fine('2101 -> response: %s', resp.replace(/(?:\r)/g, '\\r').replace(/(?:\n)/g, '\\n'));
                    let i = resp.startsWith('7EC') ? 0 : resp.indexOf('\r7EC', 0);
                    if (i < 0) {
                        debug.warn('invalid response for 2101: %s', resp.replace(/(?:\r)/g, '\\r').replace(/(?:\n)/g, '\\n'));
                        this.addStatusMessage('2101: Err1');
                    } else {
                        // this.addStatusMessage('0201: OK');
                        let currH = -1, currL = -1;
                        let volt = -1;
                        while (i > 0) {
                            const j = resp.indexOf('\r', i + 1);
                            const f =  resp.substring(i + 1, j);
                            debug.fine('response for 2101: %s', f);
                            if (f.startsWith('7EC21')) {
                                currH = parseInt(f.substring(17, 19), 16);
                            }
                            if (f.startsWith('7EC22')) {
                                currL = parseInt(f.substring(5, 7), 16);
                                volt = parseInt(f.substring(7, 11), 16);
                            }
                            i = resp.indexOf('\r7EC', j + 1);
                        }
                        if (currH >= 0 && currL >= 0) {
                            const x = currH * 256 + currL;
                            this._status.current =
                                sprintf('%.1fA (%s)', (x > 32767 ? 65536 - x : x) * 0.1 + 0.05, new Date().toLocaleTimeString());
                            debug.info('  Current: %s', this._status.current);
                        } else {
                            this._status.current = '?';
                        }
                        if (volt >= 0) {
                            this._status.voltage =
                                sprintf('%.1fV (%s)', volt * 0.1 + 0.05, new Date().toLocaleTimeString());
                            debug.info('  Voltage: %s', this._status.voltage);
                        } else {
                            this._status.voltage = '?';
                        }
                    }
                    lastResponseAt = Date.now();
                } catch (err) {
                    const rv = this._serial.clearResponse().replace(/(?:\r)/g, '\\r').replace(/(?:\n)/g, '\\n');
                    debug.warn('error: uncomplete response for 2101: %s', rv);
                    this.addStatusMessage('2101: Err2');
                    this._status.current = '?';
                    this._status.voltage = '?';
                }

                if (this._cancel) { return; }
                this._serial.clearResponse();
                await this._serial.write('2105\r\n');
                try {
                    const resp = await this._serial.readResponse(15000);
                    debug.fine('2105 -> response: %s', resp.replace(/(?:\r)/g, '\\r').replace(/(?:\n)/g, '\\n'));
                    let i = resp.startsWith('7EC') ? 0 : resp.indexOf('\r7EC');
                    if (i < 0) {
                        debug.warn('invalid response for 2105: %s', resp.replace(/(?:\r)/g, '\\r').replace(/(?:\n)/g, '\\n'));
                        this.addStatusMessage('0205: Err1');
                    } else {
                        while (i > 0) {
                            // this.addStatusMessage('0205: OK');
                            const j = resp.indexOf('\r', i + 1);
                            const s = resp.substring(i, j);
                            debug.fine('response for 2105: %s', s);
                            const x = s.indexOf('7EC24');
                            if (s.startsWith('7EC24')) {
                                const strSoc = s.substring(17, 19);
                                const soc = parseInt(strSoc, 16) / 2;
                                debug.info('%s ... SOC: %s%%', strSoc, soc);
                                this._status.soc = soc + '%' + ' (' + new Date().toLocaleTimeString() + ')';
                            }
                            i = resp.indexOf('7EC', j);
                        }
                    }
                    lastResponseAt = Date.now();
                } catch (err) {
                    this.addStatusMessage('Error 1');
                    const rv = this._serial.clearResponse().replace(/(?:\r)/g, '\\r').replace(/(?:\n)/g, '\\n');
                    debug.warn('error -> uncomplete response for 2105: %s', rv);
                }

            } catch (err) {
                debug.warn(err);
                this.addStatusMessage('Error 2');
                this._status.current = '?';
                this._status.voltage = '?';
                await this.delayMillis(1000);
            }
        }

    }


    private async delayMillis (timeoutMillis: number): Promise<void> {
        return new Promise<void>( (res, rej) => {
            setTimeout( () => {
                res();
            }, timeoutMillis);
        });
    }


    private async init () {
        switch (this._config.type) {
            case 'sim': {
                this._serial = new Sim();
                await this._serial.connect();
                this._status.connected = true;
                this._status.type = 'sim';
                break;
            }

            case 'usb': {
                this._serial = new Usb(this._config.serialPort.device, this._config.serialPort.options);
                await this._serial.connect();
                this._status.connected = true;
                this._status.type = 'usb';
                break;
            }

            case 'wlan':      throw new Error('config.type ' + this._config.type + ' not supported');
            case 'bluetooth': throw new Error('config.type ' + this._config.type + ' not supported');

            default: {
                throw new Error('config.type ' + this._config.type + ' not supported');
            }

        }
    }

    private addStatusMessage (msg: string) {
        this._status.status.push({
            at: new Date(),
            message: msg
        });
        if (this._status.status.length > 3) {
            this._status.status.splice(0, this._status.status.length - 3);
        }
    }

}

export interface IObd2Status {
    lastRefresh?: string;
    connected: boolean;
    type?: 'sim' | 'usb' | 'wlan' | 'bluetooth';
    status?: { at: Date, error?: string, message?: string } [];
    soc?: string;
    current?: string;
    voltage?: string;
}
