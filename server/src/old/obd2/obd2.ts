import * as debugsx from 'debug-sx';
const debug: debugsx.IFullLogger = debugsx.createFullLogger('old::odb2:obd2');

import * as events from 'events';

import * as nconf from 'nconf';
import { DTC } from './core/dtc';
import { PID } from './core/pid';
import { OBD } from './core/obd';
import { Ticker } from './core/ticker';
import { Device } from './device/device';
import { SerialBase } from './serial/serial-base';
import { Usb } from './serial/usb';
import * as SerialPort from 'serialport';
import { FakeSerial } from './core/fakeserial';

export class OBD2 extends events.EventEmitter {

    public static getInstance (): OBD2 {
        if (OBD2._instance === undefined) {
            OBD2._instance = new OBD2();
        }
        return OBD2._instance;
    }

    private static _instance: OBD2;



    // ************************************************

    private _config: IOBD2Config;

    private _dtc: DTC;
    private _pid: PID;
    private _obd: OBD;
    private _ticker: Ticker;
    private _device: Device;
    private _serial: SerialBase;

    private constructor (config?: IOBD2Config) {
        super();
        config = config || nconf.get('obd2');
        if (!config) { throw new Error('missing config'); }
        this._config = config;
    }

    public async init (): Promise<void> {
        this._dtc = new DTC();
        this._pid = new PID();
        this._obd = new OBD( this._pid.getListPID() );
        this._ticker = new Ticker( this._config.timeoutMillis );
        this._device = new Device(this._config.device);

        const options: SerialPort.OpenOptions = {
            baudRate : this._config.baudRate
        };

        switch (this._config.serialType) {
            case 'none': break;
            case 'usb':  this._serial = new Usb( this._config.serialPort, options, this._config.simulate); break;
            default: throw new Error('invalid serialType value');
        }

    }


    public async start (): Promise<void> {
        this._serial.on( 'data', ( data: any ) => {
            this._obd.parseDataStream( data, ( type: any, mess: any ) => {
                this.emit( type, mess, data );
                this.emit( 'dataParsed', type, mess, data );
            } );

            this.emit( 'dataReceived', data );

        } );

        return new Promise<void>( (res, rej) => {
            this._serial.connect( () => {
                this._device.connect( this, () => {
                    // this._serial.getSerial().on('data', ( data: any ) => {
                    //     console.log('data2', data);
                    // });
                    res();
                } );

            } );
        });

    }


    public async listDTC (): Promise<{ mess: any, data: any }> {
        const result: { mess: any, data: any } = await this.sendPID( '', '03');
        return result;

    }


    public sendAT( atCommand: string ) {
        // atCommand = atCommand.replace(/'' ''/g, '''');
        // atCommand = String(atCommand).replace('' '', '''');

        this._ticker.addItem( 'AT', atCommand, false, ( next: any ) => {
            this._serial.drain( atCommand + '\r' );
            this.once( 'dataReceived', ( data: any ) => {
                // Wait a bit
                setTimeout( next, 100 );
            } );
        } );

    }

    public async sendPID ( pidNumber: string, pidMode?: string): Promise<{mess: any, data: any}> {
        return this.writePID( undefined, false, pidNumber, pidMode );
    }


    /**
     * Writing PID
     *
     * @param replies
     * @param loop
     * @param pidNumber
     * @param pidMode
     * @param callBack
     */
    public async writePID ( replies: string, loop: boolean, pidNumber: string, pidMode?: string): Promise<{mess: any, data: any}> {

        if ( typeof pidMode === 'function' ) {
            debug.warn('pidMode function not supported');
            pidMode  = '01';
        } else {
            pidMode = !pidMode ? '01' : pidMode;
        }

        // Vars
        const pidData = this._pid.getByPid( pidNumber, pidMode );
        let sendData = '';
        replies = !replies ? '' : replies;

        // PID defined?
        if ( pidData ) {
            // MODE + PID + (send/read)
            if ( pidData.pid !== 'undefined' ) {
                sendData = pidData.mode + pidData.pid + replies + '\r';
            } else {  // Only mode send ( ex. DTC )
                sendData = pidData.mode + replies + '\r';
            }
        } else { // Undefined PID
            sendData = pidMode + pidNumber + replies + '\r';
        }

        // Add Ticker
        return new Promise<{mess: any, data: any}>( (res, rej) => {
            this._ticker.addItem( 'PID', sendData, !!loop, ( next: any, elem: any ) => {
                // Timeout let for auto cleaning
                let itemSkip: any;

                // Send data
                if ( elem.fail % 20 === 0 ) {
                    this._serial.drain( sendData );
                }

                // Detected parsed PID data
                this.once( 'pid', ( mess, data ) => {
                    res({ mess: mess, data: data });
                    debug.info('result -> clearTimeout ' + itemSkip);
                    if (itemSkip) {
                        debug.info('clearTimeout');
                        clearTimeout( itemSkip );
                        itemSkip = undefined;
                    }
                    next();
                } );


                // Timeout timer
                debug.info('setTimeout');
                itemSkip = setTimeout( () => {
                    // Fail to remove
                    elem.fail++;

                    // Auto remover, 60 loop wait, 4 sending try
                    if ( this._config.cleaner && elem.fail > 60 ) {
                        this._ticker.delItem( 'PID', sendData );
                        rej(new Error('timeout'));
                    }
                    next();
                }, this._config.timeoutMillis );
            });
        });
    }

}

export interface IOBD2Config {
    serialType: 'none' | 'usb';
    simulate?: boolean;
    serialPort: string;
    timeoutMillis: number;
    device: 'elm327';
    baudRate: 38400;
    cleaner: boolean;
}
