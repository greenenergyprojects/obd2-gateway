import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('odb2:dtc');

import fs	= require('fs');
import path	= require('path');

export class DTC {

    private list: string [] = [];

    public constructor () {
        this.loadDtcList();
        debug.fine('Ready');
    }

    public loadDtcList (basePath?: string) {
        debug.fine('Loading list');

        basePath = basePath
            ? basePath
            : path.join( __dirname, '..', 'data', 'dtc' )
        ;

        try {
            if ( fs.statSync( basePath ) ) {
                fs.readdirSync( basePath ).forEach( ( file: string ) => {
                    this.list.push( require( path.join( basePath, file ) ) );
                });
            }
        } catch ( e ) {
            debug.warn('[ERROR] Data directory not found!\n%e', e);
        }

        debug.fine('Loaded count: ' + this.list.length);
    }

    public getList(): string [] {
        return this.list;
    }

    public getByName( slug: string ) {
        //
    }

    public getByPid ( pid: string, mode?: string ) {
        //
    }

}
