
import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('odb2:serial:serial-base');

import * as events from 'events';
import { OBD2_SerialInterface } from '../typings/odb2/odb2-types';


export class SerialBase extends events.EventEmitter implements OBD2_SerialInterface {
    private Serial: any;

    private port: string;
    private options: any;
    private opened: boolean;


    /**
     * Constructor
     */
    public constructor () {
        super();

        this.opened = false;

        this.emit( 'ready' );
    }


    public onData ( callBack: any ) {
        this.Serial.on( 'data', callBack );
    }

    /**
     * Serial port connect
     */
    public connect( callBack: any ) {
        this.Serial.open( ( error: any ) => {
            this.opened = !!(typeof this.Serial.isOpen === 'function'
                    ? this.Serial.isOpen()
                    : this.Serial.isOpen
            );

            if ( typeof callBack === 'function' ) {
                callBack();
            }

        } );
    }


    /**
     * Serial port disconnect
     */
    public disconnect ( callBack: any ) {
        this.Serial.close( ( error: any ) => {
            this.opened = !!(typeof this.Serial.isOpen === 'function'
                    ? this.Serial.isOpen()
                    : this.Serial.isOpen
            );

            if ( typeof callBack === 'function' ) {
                callBack();
            }

        } );
    }


    /**
     *
     * Serial data drain
     *
     * @param data
     * @param callBack
     */
    public drain( data: string, callBack?: any ) {
        // Serial is opened
        if ( this.opened ) {

            // Try write data
            try {
                this.emit( 'write', data );
                this.Serial.write( data, ( error: any ) => {
                    if ( typeof callBack === 'function' ) {
                        this.Serial.drain( callBack );
                    }
                } );
            } catch ( e ) {
                debug.warn( 'Error while writing, connection is probably lost.\n%e', e);
            }
        }
    }


    /**
     * Serial data write
     *
     * @param data
     * @param callBack
     */
    public write ( data: string, callBack: any ) {
        // Serial is opened
        if ( this.opened ) {

            // Try write data
            try {
                this.emit( 'write', data );
                this.Serial.write( data, ( error: any ) => {
                    if ( typeof callBack === 'function' ) {
                        callBack();
                    }
                } );
            } catch ( e ) {
                debug.warn( 'Error while writing, connection is probably lost.\n%e', e );
            }
        }
    }


    /**
     * Serial port instance set
     *
     * @param serial
     */
    public setSerial ( serial: any ) {
        this.Serial = serial;
        this._eventHandlers();
    }


    /**
     * Serial port instance get
     *
     * @returns {any}
     */
    public getSerial (): any {
        return this.Serial;
    }


    /**
     * Set serial port
     *
     * @param port
     */
    public setPort ( port: string ) {
        this.port = port;
    }


    /**
     * Get serial port
     *
     * @returns {string}
     */
    public getPort (): string {
        return this.port;
    }


    /**
     * Set serial options
     *
     * @param options
     */
    public setOptions ( options: any ) {
        this.options = options;
    }


    /**
     * Get serial options
     *
     * @returns {any}
     */
    public getOptions (): any {
        return this.options;
    }


    /**
     * Get serial port is opened
     *
     * @returns {boolean}
     */
    public isOpen (): boolean {
        return this.opened;
    }


    /**
     * Shared events handling
     *
     * @private
     */
    public _eventHandlers() {
        this.Serial.on( 'ready', () => {
            debug.fine( 'Serial port ready' );
        } );

        this.Serial.on( 'open', ( port: any ) => {
            debug.fine( 'Serial port open : ' + port );
        } );

        this.Serial.on( 'close', ( port: any ) => {
            debug.fine( 'Serial port close: ' + port );
        } );

        this.Serial.on( 'error', ( error: any ) => {
            debug.fine( 'Serial port error: ' + error );
        } );

        this.Serial.on( 'data', ( data: any, port: any ) => {
            this.emit( 'data', data );
            data = String( data ).replace( /(?:\r\n|\r|\n)/g, '' );
            debug.fine( 'Serial port data : ' + data );
        } );

        this.on( 'write', ( data, port ) => {
            data = String( data ).replace( /(?:\r\n|\r|\n)/g, '' );
            debug.fine( 'Serial port write: ' + data );
        } );

    }

}
