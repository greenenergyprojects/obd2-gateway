import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('odb2:device');

import { ELM327 } from './elm327';

export class Device {

    private _device: any;
    private _name: string;

    public constructor ( deviceName?: string ) {
        if ( deviceName ) {
            this.loadDevice( deviceName );
        }
        debug.fine('Ready');
    }

    public connect( Serial: any, cb ?: any ) {
        debug.fine('Connecting');

        this._device.connect( Serial, () => {
            debug.fine('Connected');

            // Callback
            cb();
        });
    }

    public disconnect ( Serial: any ) {
        //
    }

    public loadDevice ( deviceName: string ) {
        this._name  = deviceName.toLowerCase();
        // this._device = new (require(
        //     path.join( __dirname, this._name, 'index' )
        // )).OBD2.Device.ELM327();
        switch (this._name) {
            case 'elm327': {
                this._device = new ELM327();
                break;
            }
            default: throw new Error('device ' + deviceName + ' not supported');
        }
        debug.fine('Loaded device: ' + this._name);
    }

    public getDevice (): any {
        return this._device;
    }

    public getDeviceName (): string {
        return this._name;
    }

    // public setDevice ( deviceObject: any ) {
    //     this._device = deviceObject;
    // }
}

