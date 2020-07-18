import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('odb2:pid');

import fs	= require('fs');
import path	= require('path');


export class PID {

    /**
     * Loaded data PID list
     *
     * @type {Array}
     */
    private listPid: any [] = [];

    /**
     * Supported ECU list
     *
     * @type {Array}
     */
    private listEcu: any [] = [];

    /**
     * Real ECU+DATA supported PID list
     *
     * @type {Array}
     */
    private pidEcuList: any [] = [];

    /**
     * Constructor
     *
     * @test Obd2CorePidTest
     */
    constructor() {
        this.loadPidList();
        debug.fine('Ready');
    }



    /**
     * PID support command parser, and appender
     *
     * @param returnType
     * @param returnValue
     * @returns {boolean}
     * @private
     *
     * @test Obd2CorePidTest
     */
    public loadPidEcuList (returnType: string, returnValue: string ): boolean {
        const decodeList: { [key: string]: number [] } = {
                '0' : [ 0, 0, 0, 0 ],
                '1' : [ 0, 0, 0, 1 ],
                '2' : [ 0, 0, 1, 0 ],
                '3' : [ 0, 0, 1, 1 ],
                '4' : [ 0, 1, 0, 0 ],
                '5' : [ 0, 1, 0, 1 ],
                '6' : [ 0, 1, 1, 0 ],
                '7' : [ 0, 1, 1, 1 ],
                '8' : [ 1, 0, 0, 0 ],
                '9' : [ 1, 0, 0, 1 ],
                'A' : [ 1, 0, 1, 0 ],
                'B' : [ 1, 0, 1, 1 ],
                'C' : [ 1, 1, 0, 0 ],
                'D' : [ 1, 1, 0, 1 ],
                'E' : [ 1, 1, 1, 0 ],
                'F' : [ 1, 1, 1, 1 ],
            };

        const pidCommands: { [ key: string ]: string } = {
                'pidsupp0' : '00',
                'pidsupp2' : '20',
                'pidsupp4' : '40',
                'pidsupp6' : '60',
                'pidsupp8' : '80',
                'pidsuppa' : 'A0',
                'pidsuppc' : 'C0',
            };

        let hexNum;
        let defNum = 0;
        let tmpPid = '';
        let tmpFind = false;

        // pidsupp0, pidsupp2, ...
        if ( !pidCommands[returnType]) {
            return false;
        }

        // Start list, pl [00-19, 20-39, 40-59, ...]
        defNum = this._hex2dec( pidCommands[ returnType ] );

        // Hexadecimal value
        // Pl.: BE1FA813
        returnValue = String( returnValue );


        // Átfutunk a bejövő számon
        for ( let i = 0; i < returnValue.length; i++ ) {

            hexNum = this._hex2dec( returnValue.charAt( i ) );

            // Megnézzük melyik PID támogatott
            for ( let j = 0; j < 4; j++ ) {
                // Check PID is supported
                if ( decodeList[ returnValue.charAt( i ) ][ j ] === 1 ) {
                    // Pl.: 0*4 + 1*1 = 01
                    // 2*4 + 0*3 = 11 = 0B
                    // defNum is a shifting number
                    // Pl: 20 + 0*4 + 1 = 21

                    tmpPid = this.dec2hex( defNum + (i * 4) + (j + 1) );

                    if ( tmpPid.length === 1 ) {
                        tmpPid = '0' + tmpPid;
                    }

                    // Push supperted PID
                    this.listEcu.push( tmpPid );
                    tmpFind    = true;

                }
            }
        }

        // Clear array
        this.listEcu = this.listEcu.filter( ( value, index, self ) => {
            return self.indexOf( value ) === index;
        } );

        return tmpFind;
    }


    /**
     * Get real supported ECU PID list
     *
     * @returns {any}
     *
     * @test Obd2CorePidTest
     */
    public getList () {
        if ( this.pidEcuList.length > 0 ) {
            return this.pidEcuList;
        }

        for ( const index in this.listPid ) {
            if ( this.listPid.hasOwnProperty( index ) ) {
                const temp = String( this.listPid[ index ].pid );

                if ( temp && this.listEcu.indexOf( temp ) > -1 ) {
                    this.pidEcuList.push( temp );
                }
            }
        }

        this.pidEcuList = this.pidEcuList.filter( ( value, index, self ) => {
            return self.indexOf( value ) === index;
        });

        return this.pidEcuList;
    }


    /**
     * Get PID details list
     *
     * @returns {any}
     *
     * @test Obd2CorePidTest
     */
    public getListPID () {
        return this.listPid;
    }


    /**
     * Get supported ECU PID list
     *
     * @returns {any}
     *
     * @test Obd2CorePidTest
     */
    public getListECU () {
        return this.listEcu;
    }


    /**
     * Get PID details by name/slug
     *
     * @param slug
     * @returns {any}
     *
     * @test Obd2CorePidTest
     */
    public getByName (slug: string ) {
        for ( const index in this.listPid ) {
            if ( typeof this.listPid[ index ].name === 'undefined' ) {
                continue;
            }

            if ( this.listPid[ index ].name.toLowerCase() === slug.toLowerCase() ) {
                return this.listPid[ index ];
            }
        }

        return undefined;
    }


    /**
     * Get PID details by pid/mode
     *
     * @param pid
     * @param mode
     * @returns {any}
     *
     * @test Obd2CorePidTest
     */
    public getByPid ( pid: string, mode?: string ) {
        mode = !mode ? '01' : mode;

        for ( const index in this.listPid ) {
            if ( typeof this.listPid[ index ].pid === 'undefined' || typeof this.listPid[ index ].mode === 'undefined' ) {
                continue;
            }

            if ( this.listPid[ index ].pid.toLowerCase() === pid.toLowerCase() &&
                 this.listPid[ index ].mode.toLowerCase() === mode.toLowerCase() ) {
                return this.listPid[ index ];
            }
        }

        return undefined;
    }


    /**
     * Loading PID details from data directory
     *
     * @param basePath
     * @private
     *
     * @test Obd2CorePidTest
     */
    private loadPidList = ( basePath?: string ) => {
        debug.fine('Loading list');

        basePath = basePath
            ? basePath
            : path.join( __dirname, '..', 'data', 'pid' )
        ;

        try {
            if ( fs.statSync( basePath ) ) {
                fs.readdirSync( basePath ).forEach( ( file: string ) => {
                    const tmpPidObject = require( path.join( basePath, file ) );
                    this.listPid.push( tmpPidObject );
                } );
            }
        } catch ( e ) {
            debug.warn('[ERROR] Data directory %s not found!', basePath);
        }

        debug.fine('Loaded count: %d', this.listPid.length);
    }



    /**
     * Converting DEC to HEX number
     *
     * @param decNumber
     * @returns {string}
     * @private
     *
     * @test Obd2CorePidTest
     */
    private dec2hex ( decNumber: number ): string {
        let hexNumber: string;

        if ( decNumber < 0 ) {
            decNumber = 0xFFFFFFFF + decNumber + 1;
        }

        hexNumber = String( decNumber.toString( 16 ).toUpperCase() );

        if ( hexNumber.length === 1 ) {
            hexNumber = '0' + hexNumber;
        }

        return hexNumber;
    }


    /**
     * Converting HEX to DEC number
     *
     * @param hexNumber
     * @returns {number}
     * @private
     *
     * @test Obd2CorePidTest
     */
    private _hex2dec ( hexNumber: string ): number {
        return parseInt( hexNumber, 16 );
    }

}
