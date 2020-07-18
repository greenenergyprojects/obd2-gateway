

import * as SerialPort from 'serialport';
import { SerialBase } from './serial-base';
import { FakeSerial } from '../core/fakeserial';

export class Usb extends SerialBase {
    /**
     * Constructor
     *
     * @param port
     * @param options
     */
    public constructor ( port: string, options?: any, simulate?: boolean ) {
        super();

        this.setPort( port );
        this.setOptions( options );
        if (simulate) {
            this.setSerial(
                new FakeSerial(port, options)
            );
        } else {
            this.setSerial(
                new SerialPort( port, options)
            );
        }

    }

}
