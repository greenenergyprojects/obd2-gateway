
import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('odb2:serial:serial-base');

import * as events from 'events';


export abstract class SerialBase extends events.EventEmitter implements SerialInterface {

    private _waiting: IWaiting = { received: '' };

    /**
     * Constructor
     */
    public constructor () {
        super();
    }


    public async abstract connect (): Promise<void>;
    public async abstract disconnect (): Promise<void>;
    public abstract isOpen (): boolean;
    public abstract write (data: string | Buffer | Uint8Array, encoding?: string): Promise<boolean>;

    public clearResponse (): string {
        const rv = this._waiting.received;
        this._waiting.received = '';
        if (this._waiting.at > 0) {
            delete this._waiting.at;
        }
        if (this._waiting.timer) {
            clearTimeout(this._waiting.timer);
            delete this._waiting.timer;
        }
        const rej = this._waiting.rej;
        if (this._waiting.rej) {
            delete this._waiting.rej;
        }
        if (this._waiting.res) {
            delete this._waiting.res;
        }
        if (rej) {
            rej(new Error('Cancelled by call of clearResponse()'));
        }
        return rv;
    }


    public readResponse (timeoutMillis: number): Promise<string> {
        return new Promise<string>( (res, rej) => {
            const thiz = this;
            if (this._waiting.at > 0) {
                const reject = this._waiting.rej;
                delete thiz._waiting.at;
                if (thiz._waiting.timer) {
                    clearTimeout(this._waiting.timer);
                }
                delete thiz._waiting.timer;
                delete thiz._waiting.res;
                delete thiz._waiting.rej;
                reject(new Error('Cancelled by call of readResponse()'));
            }
            this._waiting.at = Date.now();
            this._waiting.res = res;
            this._waiting.rej = rej;
            this._waiting.timer = setTimeout( () => {
                delete thiz._waiting.at;
                delete thiz._waiting.timer;
                delete thiz._waiting.res;
                delete thiz._waiting.rej;
                rej(new Error('Timeout'));
            }, timeoutMillis );
        });
    }


    protected processResponseData (data: string | Buffer | Uint8Array) {
        let buf: Uint8Array;
        if (typeof data === 'string') {
            buf = new Uint8Array(Buffer.from(data, 'utf-8'));
        } else if (data instanceof ArrayBuffer) {
            buf = new Uint8Array(data);
        } else if (data instanceof Uint8Array) {
            buf = data;
        } else {
            debug.warn('invalid response data %o', data);
            return;
        }
        const s = Buffer.from(buf).toString('utf-8');
        debug.fine('process received data: %s', s.replace(/(?:\r)/g, '\\r').replace(/(?:\n)/g, '\\n'));
        this._waiting.received += s;
        const index = this._waiting.received.indexOf('\r>');
        debug.fine('process... index=%s at=%s' , index, this._waiting.at);
        if (index >= 0 && this._waiting.at > 0) {
            const rv = this._waiting.received.substring(0, index + 2);
            const res = this._waiting.res;
            if (this._waiting.timer) {
                clearTimeout(this._waiting.timer);
            }
            this._waiting = { received: this._waiting.received.substring(index + 2) };
            debug.fine('process finished... _waiting=%o' , this._waiting);
            res(rv);

        }

    }


    // public abstratc onData ( callBack: any ) {
    //     this._serial.on( 'data', callBack );
    // }



    // /**
    //  * Serial port disconnect
    //  */
    // public disconnect ( callBack: any ) {
    //     this.Serial.close( ( error: any ) => {
    //         this.opened = !!(typeof this.Serial.isOpen === 'function'
    //                 ? this.Serial.isOpen()
    //                 : this.Serial.isOpen
    //         );

    //         if ( typeof callBack === 'function' ) {
    //             callBack();
    //         }

    //     } );
    // }


    // /**
    //  *
    //  * Serial data drain
    //  *
    //  * @param data
    //  * @param callBack
    //  */
    // public drain( data: string, callBack?: any ) {
    //     // Serial is opened
    //     if ( this.opened ) {

    //         // Try write data
    //         try {
    //             this.emit( 'write', data );
    //             this.Serial.write( data, ( error: any ) => {
    //                 if ( typeof callBack === 'function' ) {
    //                     this.Serial.drain( callBack );
    //                 }
    //             } );
    //         } catch ( e ) {
    //             debug.warn( 'Error while writing, connection is probably lost.\n%e', e);
    //         }
    //     }
    // }


    // /**
    //  * Serial data write
    //  *
    //  * @param data
    //  * @param callBack
    //  */
    // public write ( data: string, callBack: any ) {
    //     // Serial is opened
    //     if ( this.opened ) {

    //         // Try write data
    //         try {
    //             this.emit( 'write', data );
    //             this.Serial.write( data, ( error: any ) => {
    //                 if ( typeof callBack === 'function' ) {
    //                     callBack();
    //                 }
    //             } );
    //         } catch ( e ) {
    //             debug.warn( 'Error while writing, connection is probably lost.\n%e', e );
    //         }
    //     }
    // }


    // /**
    //  * Serial port instance set
    //  *
    //  * @param serial
    //  */
    // public setSerial ( serial: any ) {
    //     this.Serial = serial;
    //     this._eventHandlers();
    // }


    // /**
    //  * Serial port instance get
    //  *
    //  * @returns {any}
    //  */
    // public getSerial (): any {
    //     return this.Serial;
    // }


    // /**
    //  * Set serial port
    //  *
    //  * @param port
    //  */
    // public setPort ( port: string ) {
    //     this.port = port;
    // }


    // /**
    //  * Get serial port
    //  *
    //  * @returns {string}
    //  */
    // public getPort (): string {
    //     return this.port;
    // }


    // /**
    //  * Set serial options
    //  *
    //  * @param options
    //  */
    // public setOptions ( options: any ) {
    //     this.options = options;
    // }


    // /**
    //  * Get serial options
    //  *
    //  * @returns {any}
    //  */
    // public getOptions (): any {
    //     return this.options;
    // }


    // /**
    //  * Get serial port is opened
    //  *
    //  * @returns {boolean}
    //  */
    // public isOpen (): boolean {
    //     return this.opened;
    // }


    // /**
    //  * Shared events handling
    //  *
    //  * @private
    //  */
    // public _eventHandlers() {
    //     this.Serial.on( 'ready', () => {
    //         debug.fine( 'Serial port ready' );
    //     } );

    //     this.Serial.on( 'open', ( port: any ) => {
    //         debug.fine( 'Serial port open : ' + port );
    //     } );

    //     this.Serial.on( 'close', ( port: any ) => {
    //         debug.fine( 'Serial port close: ' + port );
    //     } );

    //     this.Serial.on( 'error', ( error: any ) => {
    //         debug.fine( 'Serial port error: ' + error );
    //     } );

    //     this.Serial.on( 'data', ( data: any, port: any ) => {
    //         this.emit( 'data', data );
    //         data = String( data ).replace( /(?:\r\n|\r|\n)/g, '' );
    //         debug.fine( 'Serial port data : ' + data );
    //     } );

    //     this.on( 'write', ( data, port ) => {
    //         data = String( data ).replace( /(?:\r\n|\r|\n)/g, '' );
    //         debug.fine( 'Serial port write: ' + data );
    //     } );

    // }

}

interface IWaiting {
    at?: number;
    timer?: NodeJS.Timeout;
    res?: (response: string) => void;
    rej?: (err: Error) => void;
    received: string;
}

export interface SerialInterface {
    // Base commands
    connect (): Promise<void>;

    // disconnect? ( callBack: any ): void;
    // write? ( data: string, callBack?: any ): void;
    // drain? ( data: string, callBack?: any ): void;
    // readWrite? ( data: string, callBack: any, timeout?: number ): void;

    // onData? ( callback: any ): void;

    // setSerial? ( serial: any ): void;
    // getSerial? (): any;

    // setPort? ( port: string ): void;
    // getPort? (): string;

    // setOptions? ( options: any ): void;
    // getOptions? (): any;


    // isOpen? (): boolean;
    // // Event handler
    // on? ( type: string, cb?: any ): void;
    // // removeListener?( type : string, cb? : any );
}
