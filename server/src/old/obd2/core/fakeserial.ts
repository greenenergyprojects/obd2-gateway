import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('odb2:core:fakeserial');

import * as events from 'events';
import * as fs from 'fs';
import path	= require('path');

export class FakeSerial extends events.EventEmitter {

    private opened = false;
    private commands: any [] = [];
    private fakePort: string;

    private modes: { [ key: string ]: number } =  {
        L : 1,
        E : 1,
    };

    public constructor ( fakePort?: string, fakeOptions?: any, openImmediately?: boolean ) {
        super();

        const basePath = path.join( __dirname, '..', 'data', 'pid' )
        ;

        try {
            if ( fs.statSync( basePath ) ) {
                fs.readdirSync( basePath ).forEach( ( file: string ) => {
                    const tmpPidObject = require( path.join( basePath, file ) );
                    this.commands.push( tmpPidObject );
                } );
            }
        } catch ( e ) {
            debug.warn('[ERROR] Data directory %s not found!', basePath);
        }


        this.fakePort = fakePort;
        if ( openImmediately === true || typeof openImmediately === 'undefined' ) {
            process.nextTick( () => {
                this.emit( 'open', 'fakeSerial:' + this.fakePort );
                this.opened = true;
            } );
        }

    }

    public open ( cb: any ) {
        if ( !this.opened ) {
            this.emit( 'open', 'fakeSerial:' + this.fakePort );
            this.opened = true;
        }

        cb();

    }

    public close ( cb: any ) {
        if ( this.opened ) {
            this.emit( 'close' );
            this.opened = false;
        }

        cb();

    }

    public isOpen = () => {
        return this.opened;
    }

    public writeNext = ( data: any ) => {
        process.nextTick( () => {
            this.emit( 'data', data + '\r\r' );
        } );
    }

    public drain = ( callBack: any ) => {
        if ( typeof callBack === 'function' ) {
            callBack();
        }
    }

    public write = ( data: any ) => {
        data = data.replace( '\n', '' ).replace( '\r', '' );

        if ( data.substring( 0, 2 ) === 'AT' ) {
            const mode = data.substring( 3, 4 );
            for ( const m in this.modes ) {
                if ( mode === m ) {
                    this.modes[ m ] = 0;

                    if ( data.substring( 4, 5 ) === '1' ) {
                        this.modes[ m ] = 1;
                    }
                }
            }
        }

        if ( this.modes.E ) {
            // echo
            // this.writeNext(data);
        }

        if ( data === 'AT E0' ) {
            this.writeNext( data );

            return;
        }

        if ( data.substring( 0, 2 ) === '03' ) {
            return this.writeNext( ('>4301000A000000').toUpperCase() );
        }

        // if (data === '0100' || data === '0120')
        if ( data === '0100' || data === '0120' || data === '0140' || data === '0160' || data === '0180' ||
             data === '01A0' || data === '01C0' ) {
            return this.findSupportedPins( data );
        }

        if ( data.substring( 0, 2 ) !== '01' ) {
            return this.writeNext( '?' );
        }

        const cmd = data.substring( 2, 4 );
        for ( let i = 0; i < this.commands.length; i++ ) {
            if ( this.commands[ i ].pid === cmd ) {
                if ( typeof this.commands[ i ].testResponse === 'function' ) {
                    let res = this.commands[ i ].testResponse( data ).toString( 16 );
                    if ( res.length % 2 === 1 ) {
                        res = '0' + res;
                    }

                    return this.writeNext( ('>41' + cmd + '' + res).toUpperCase() );
                }
            }
        }

        return this.writeNext( '?' );
    }

    public findSupportedPins = ( data: any ) => {
        // writes 4 bytes.
        // with bits encoded as 'supported' pins

        const pins = [
            //  01, 02, 03, 04, 05, 06, 07, 08
            [ 0, 0, 0, 0, 0, 0, 0, 0 ],
            //  09, 0A, 0B, 0C, 0D, 0E, 0F, 10
            [ 0, 0, 0, 0, 0, 0, 0, 0 ],
            //  11, 12, 13, 14, 15, 16, 17, 18
            [ 0, 0, 0, 0, 0, 0, 0, 0 ],
            //  19, 1A, 1B, 1C, 1D, 1E, 1F, 20
            [ 0, 0, 0, 0, 0, 0, 0, 0 ],
            [ 0, 0, 0, 0, 0, 0, 0, 0 ],
        ];

        if ( data === '0100' ) {
            pins[ 3 ][ 0 ] = 1;
            pins[ 1 ][ 3 ] = 1;
            pins[ 1 ][ 4 ] = 1;
            pins[ 1 ][ 5 ] = 1;
            pins[ 1 ][ 6 ] = 1;
        }
        if ( data === '0120' ) {
            pins[ 3 ][ 0 ] = 1;
        }
        if ( data === '0140' ) {
            pins[ 3 ][ 0 ] = 1;
        }
        if ( data === '0160' ) {
            // pins[3][0] = 1;
        }
        if ( data === '0180' || data === '01A0' || data === '01C0' ) {
            return this.writeNext( 'NO DATA' );
        }

        const bytes: number [] = [];
        for ( let i = 0; i < pins.length; i++ ) {
            let byte = 0;

            for ( let b = 0; b < pins[ i ].length; b++ ) {
                if ( pins[ i ][ b ] === 1 ) {
                    /* tslint:disable:no-bitwise */
                    byte ^= 1 << b;
                    /* tslint:enable:no-bitwise */
                }
            }

            bytes.push( byte );
        }

        const byteString = [ '>41', data.substring( 2, 4 ) ];

        for ( let i = 0; i < bytes.length; i++ ) {
            let s = bytes[ i ].toString( 16 );
            if ( s.length === 1 ) {
                s = '0' + s;
            }

            byteString.push( s );
        }

        return this.writeNext( byteString.join( '' ) );

    }

}
