import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('odb2:sim');

import * as stream from 'stream';
import { sprintf } from 'sprintf-js';

import { SerialBase } from './serial-base';

export class Sim extends SerialBase {

    private _voltage = 13.1;
    private _mode: { echo: boolean, linefeeds: boolean, spaces: boolean, headers: boolean } =
                   { echo: true, linefeeds: true, spaces: true, headers: true };


    private _open: boolean;
    private _written: any [] = [];
    private _receivedCommand = '';
    private _response = '';
    private _pendingCommand: { at: number, timer: NodeJS.Timeout, cmd: string };

    public constructor () {
        super();
        this.on( 'data', (data: any) => this.processResponseData(data));
    }

    public async connect (): Promise<void> {
        if (this._open === true) {
            return Promise.reject(new Error('already open'));
        } else {
            this._open = true;
            debug.fine('serial simulation opened');
            this.emit('open');
            return Promise.resolve();
        }
    }

    public async disconnect (): Promise<void> {
        if (this._open === true) {
            this._open = false;
            debug.fine('serial simulation closed');
            this.emit('close');
            return Promise.resolve();
        } else {
            return Promise.reject(new Error('not open'));
        }
    }

    public isOpen (): boolean {
        return this._open === true;
    }

    public write (data: string | Buffer | Uint8Array, encoding?: string): Promise<boolean> {
        if (!this._open) {
            this.emit( 'error', new Error('write fails (not open)'));
            return Promise.reject(new Error('not open'));
        } else {
            this._written.push(data);
            process.nextTick( () => {
                this.processWritten();
            });
            return Promise.resolve(true);
        }
    }

    private processWritten () {
        while (this._written.length > 0) {
            const chunk = this._written.splice(0, 1)[0];
            let buf: Uint8Array;
            if (typeof chunk === 'string') {
                buf = new Uint8Array(Buffer.from(chunk, 'utf-8'));
            } else if (chunk instanceof ArrayBuffer) {
                buf = new Uint8Array(chunk);
            } else if (chunk instanceof Uint8Array) {
                buf = chunk;
            } else {
                debug.warn('invalid written data ' + chunk);
                buf = new Uint8Array();
            }
            const out = Buffer.alloc(buf.length);
            let i = 0, j = 0;
            for (const b of buf) {
                out.writeUInt8(b, i++);
                if (this._mode.echo) {
                    j++;
                }
                if (b === 10) {
                    this._receivedCommand += out.toString('utf-8', 0, i - 1);
                    if (j > 0) {
                        this._response += out.toString('utf-8', 0, j - 1);
                    }
                    this.processCommand(this._receivedCommand);
                    this._receivedCommand = '';
                    i = 0;
                }
            }

        }
    }


    private processCommand (cmd: string) {
        let rv = '';
        if (cmd.trim().toLowerCase().indexOf('at') === 0) {
            const s = cmd.trim().toLowerCase().substr(2).trim();
            switch (s) {
                case 'd': rv = '\rOK\r\r>'; break;
                case 'z': rv = '\rOK\r\r>'; break;
                case 'e0': this._mode.echo = false; rv = '\rOK\r\r>'; break;
                case 'e1': this._mode.echo = true; rv = '\rOK\r\r>'; break;
                case 'l0': this._mode.linefeeds = false; rv = '\rOK\r\r>'; break;
                case 'l1': this._mode.linefeeds = true; rv = '\rOK\r\r>'; break;
                case 's0': this._mode.spaces = false; rv = '\rOK\r\r>'; break;
                case 's1': this._mode.spaces = true; rv = '\rOK\r\r>'; break;
                case 'h0': this._mode.headers = false; rv = '\rOK\r\r>'; break;
                case 'h1': this._mode.headers = true; rv = '\rOK\r\r>'; break;
                case 'rv': rv = sprintf('%.1fV\r\r>', this._voltage); break;
                default: rv = '\r?\r\r>'; break;
            }
        } else {
            const newCmd = { at: Date.now(), timer: <NodeJS.Timer>null, cmd: cmd };
            const thiz = this;
            newCmd.timer = setTimeout( () => {
                thiz.executeCommand(thiz._pendingCommand.cmd);
                thiz._pendingCommand = null;
            }, 500);
            if (this._pendingCommand) {
                rv += 'STOPPED\r\r';
                if (this._pendingCommand.timer) {
                    clearTimeout(this._pendingCommand.timer);
                    this._pendingCommand = null;
                }
            }
            this._pendingCommand = newCmd;

            rv += 'SEARCHING...';
        }

        this._response += rv;
        process.nextTick( () => {
            if (this._response !== '') {
                const b =  Buffer.from(this._response, 'utf-8');
                this.emit('data', b);
                const s = b.toString('utf-8').replace(/(?:\r)/g, '<cr>').replace(/(?:\n)/g, '<lf>');
                debug.fine('response: %s', s);
            }
            this._response = '';
        });

    }


    private executeCommand (cmd: string) {
        cmd = cmd.trim();
        let rv = '';
        if (cmd === '0100') {
            if (this._mode.headers) {
                rv += '7EB06410080000001\r';
                rv += '7EC06410080000001\r';
                rv += '\r>';
            } else {
                rv += '\r410080000001\r\r>';
            }

        } else if (cmd === '2101') {
            if (this._mode.headers) {
                rv += '7EE037F2112\r';
                rv += '7EB101E6101000003FF\r';
                rv += '7EA10166101FFE00000\r';
                rv += '7EC103D6101FFFFFFFF\r';
                rv += '7ED102C6101FFFFF800\r';
                rv += '7EB210838015296BF32\r';
                rv += '7EA2109211024062F03\r';
                rv += '7EC21A726482648A3FF\r';
                rv += '7ED210099AD95D0564F\r';
                rv += '7EA22000000003E6900\r';
                rv += '7EB220000000A000F02\r';
                rv += '7EC22C80F0B17161717\r';
                rv += '7ED22026A9F02480134\r';
                rv += '7EB234204A432180018\r';
                rv += '7EA2307200000000000\r';
                rv += '7EC231616170017C802\r';
                rv += '7ED23050543102000C8\r';
                rv += '7EB2400D0FF00000000\r';
                rv += '7EC24C8010000820002\r';
                rv += '7ED24047400C876000F\r';
                rv += '7EC255E3600025E7E00\r';
                rv += '7ED25000E01F3962845\r';
                rv += '7EC2600DF230000D957\r';
                rv += '7ED26ED000C00000000\r';
                rv += '7EC27008AA19D090180\r';
                rv += '7EC280000000003E800\r';
                rv += '\r>';
            } else {
                rv += '016\r';
                rv += '0:6101FFE00000\r';
                rv += '7F2112\r';
                rv += '03D\r';
                rv += '0:6101FFFFFFFF\r';
                rv += '02C\r';
                rv += '0:6101FFFFF800\r';
                rv += '01E\r';
                rv += '0:6105FFFFFFFF\r';
                rv += '1:0921121D062703\r';
                rv += '1:009A9A96F7569D\r';
                rv += '1:AF26482648A3FF\r';
                rv += '1:0838016497BF32\r';
                rv += '2:00000000456934\r';
                rv += '2:0111A902490134\r';
                rv += '2:EB0F2616161616\r';
                rv += '2:0000000A000302\r';
                rv += '3:07200000000000\r';
                rv += '3:050743102000C8\r';
                rv += '3:1616160016CA07\r';
                rv += '3:3704DA32D0FFD0\r';
                rv += '4:021C00C8760010\r';
                rv += '4:C9010000810002\r';
                rv += '4:FF610000000000\r';
                rv += '5:5D7A00025DA300\r';
                rv += '5:000E01F3974578\r';
                rv += '6:6B000D00000000\r';
                rv += '6:00DEDE0000D908\r';
                rv += '7:008A6A61090183\r';
                rv += '8:0000000003E800\r';
                rv += '\r>';
            }

        } else if (cmd === '2105') {
            if (this._mode.headers) {
                rv += '7EA037F2112\r';
                rv += '7EC102D6105FFFFFFFF\r';
                rv += '7EB037F2112\r';
                rv += '7ED037F2112\r';
                rv += '7EE037F2112\r';
                rv += '7EC2100000000001617\r';
                rv += '7EC2217161616172648\r';
                rv += '7EC2326480001641616\r';
                rv += '7EC2403E82403E80FAF\r';
                rv += '7EC25003A0000000000\r';
                rv += '7EC2600000000000000\r';
                rv += '\r>';
            } else {
                rv += '7F2112\r';
                rv += '7F2112\r';
                rv += '02D\r';
                rv += '0:6105FFFFFFFF\r';
                rv += '7F2112\r';
                rv += '7F2112\r';
                rv += '1:00000000001616\r';
                rv += '2:16161616162648\r';
                rv += '3:26480001501515\r';
                rv += '4:03E82403E80FB8\r';
                rv += '5:003A0000000000\r';
                rv += '6:00000000000000\r';
                rv += '\r>';
            }

        } else {
            rv = '?\r>';
        }

        this._response += rv;
        process.nextTick( () => {
            if (this._response !== '') {
                const b =  Buffer.from(this._response, 'utf-8');
                this.emit('data', b);
                const s = b.toString('utf-8').replace(/(?:\r)/g, '<cr>').replace(/(?:\n)/g, '<lf>');
                debug.fine('response: %s', s);
            }
            this._response = '';
        });
    }

    // private opened = false;
    // private commands: any [] = [];
    // private fakePort: string;

    // private modes: { [ key: string ]: number } =  {
    //     L : 1,
    //     E : 1,
    // };

    // public constructor ( fakePort?: string, fakeOptions?: any, openImmediately?: boolean ) {
    //     super();

    //     const basePath = path.join( __dirname, '..', 'data', 'pid' )
    //     ;

    //     try {
    //         if ( fs.statSync( basePath ) ) {
    //             fs.readdirSync( basePath ).forEach( ( file: string ) => {
    //                 const tmpPidObject = require( path.join( basePath, file ) );
    //                 this.commands.push( tmpPidObject );
    //             } );
    //         }
    //     } catch ( e ) {
    //         debug.warn('[ERROR] Data directory %s not found!', basePath);
    //     }


    //     this.fakePort = fakePort;
    //     if ( openImmediately === true || typeof openImmediately === 'undefined' ) {
    //         process.nextTick( () => {
    //             this.emit( 'open', 'fakeSerial:' + this.fakePort );
    //             this.opened = true;
    //         } );
    //     }

    // }

    // public open ( cb: any ) {
    //     if ( !this.opened ) {
    //         this.emit( 'open', 'fakeSerial:' + this.fakePort );
    //         this.opened = true;
    //     }

    //     cb();

    // }

    // public close ( cb: any ) {
    //     if ( this.opened ) {
    //         this.emit( 'close' );
    //         this.opened = false;
    //     }

    //     cb();

    // }

    // public isOpen = () => {
    //     return this.opened;
    // }

    // public writeNext = ( data: any ) => {
    //     process.nextTick( () => {
    //         this.emit( 'data', data + '\r\r' );
    //     } );
    // }

    // public drain = ( callBack: any ) => {
    //     if ( typeof callBack === 'function' ) {
    //         callBack();
    //     }
    // }

    // public write = ( data: any ) => {
    //     data = data.replace( '\n', '' ).replace( '\r', '' );

    //     if ( data.substring( 0, 2 ) === 'AT' ) {
    //         const mode = data.substring( 3, 4 );
    //         for ( const m in this.modes ) {
    //             if ( mode === m ) {
    //                 this.modes[ m ] = 0;

    //                 if ( data.substring( 4, 5 ) === '1' ) {
    //                     this.modes[ m ] = 1;
    //                 }
    //             }
    //         }
    //     }

    //     if ( this.modes.E ) {
    //         // echo
    //         // this.writeNext(data);
    //     }

    //     if ( data === 'AT E0' ) {
    //         this.writeNext( data );

    //         return;
    //     }

    //     if ( data.substring( 0, 2 ) === '03' ) {
    //         return this.writeNext( ('>4301000A000000').toUpperCase() );
    //     }

    //     // if (data === '0100' || data === '0120')
    //     if ( data === '0100' || data === '0120' || data === '0140' || data === '0160' || data === '0180' ||
    //          data === '01A0' || data === '01C0' ) {
    //         return this.findSupportedPins( data );
    //     }

    //     if ( data.substring( 0, 2 ) !== '01' ) {
    //         return this.writeNext( '?' );
    //     }

    //     const cmd = data.substring( 2, 4 );
    //     for ( let i = 0; i < this.commands.length; i++ ) {
    //         if ( this.commands[ i ].pid === cmd ) {
    //             if ( typeof this.commands[ i ].testResponse === 'function' ) {
    //                 let res = this.commands[ i ].testResponse( data ).toString( 16 );
    //                 if ( res.length % 2 === 1 ) {
    //                     res = '0' + res;
    //                 }

    //                 return this.writeNext( ('>41' + cmd + '' + res).toUpperCase() );
    //             }
    //         }
    //     }

    //     return this.writeNext( '?' );
    // }

    // public findSupportedPins = ( data: any ) => {
    //     // writes 4 bytes.
    //     // with bits encoded as 'supported' pins

    //     const pins = [
    //         //  01, 02, 03, 04, 05, 06, 07, 08
    //         [ 0, 0, 0, 0, 0, 0, 0, 0 ],
    //         //  09, 0A, 0B, 0C, 0D, 0E, 0F, 10
    //         [ 0, 0, 0, 0, 0, 0, 0, 0 ],
    //         //  11, 12, 13, 14, 15, 16, 17, 18
    //         [ 0, 0, 0, 0, 0, 0, 0, 0 ],
    //         //  19, 1A, 1B, 1C, 1D, 1E, 1F, 20
    //         [ 0, 0, 0, 0, 0, 0, 0, 0 ],
    //         [ 0, 0, 0, 0, 0, 0, 0, 0 ],
    //     ];

    //     if ( data === '0100' ) {
    //         pins[ 3 ][ 0 ] = 1;
    //         pins[ 1 ][ 3 ] = 1;
    //         pins[ 1 ][ 4 ] = 1;
    //         pins[ 1 ][ 5 ] = 1;
    //         pins[ 1 ][ 6 ] = 1;
    //     }
    //     if ( data === '0120' ) {
    //         pins[ 3 ][ 0 ] = 1;
    //     }
    //     if ( data === '0140' ) {
    //         pins[ 3 ][ 0 ] = 1;
    //     }
    //     if ( data === '0160' ) {
    //         // pins[3][0] = 1;
    //     }
    //     if ( data === '0180' || data === '01A0' || data === '01C0' ) {
    //         return this.writeNext( 'NO DATA' );
    //     }

    //     const bytes: number [] = [];
    //     for ( let i = 0; i < pins.length; i++ ) {
    //         let byte = 0;

    //         for ( let b = 0; b < pins[ i ].length; b++ ) {
    //             if ( pins[ i ][ b ] === 1 ) {
    //                 /* tslint:disable:no-bitwise */
    //                 byte ^= 1 << b;
    //                 /* tslint:enable:no-bitwise */
    //             }
    //         }

    //         bytes.push( byte );
    //     }

    //     const byteString = [ '>41', data.substring( 2, 4 ) ];

    //     for ( let i = 0; i < bytes.length; i++ ) {
    //         let s = bytes[ i ].toString( 16 );
    //         if ( s.length === 1 ) {
    //             s = '0' + s;
    //         }

    //         byteString.push( s );
    //     }

    //     return this.writeNext( byteString.join( '' ) );

    // }

}
