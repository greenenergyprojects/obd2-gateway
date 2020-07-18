import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('odb2:ticker');


export class Ticker {

    private Ticker: any;

    private commands: any;
    private timeoutMillis: number;
    private counter: number;
    private waiting: boolean;
    private stopped: boolean;

    constructor( timeoutMillis: number ) {
        this.timeoutMillis = timeoutMillis;

        this.commands = [];
        this.counter  = 0;
        this.stopped  = true;
        this.waiting  = false;

        debug.fine('Ready');
    }

    public writeNext () {
        if ( this.commands.length > 0 ) {
            this.waiting = true;

            const cmd = this.commands.shift();

            debug.fine( 'Tick ' + String( cmd.type ) + ' : ' + String( cmd.data ) );

            cmd.call(
                () => {
                    this.waiting = false;
                },
                cmd
            );

            if ( cmd.loop ) {
                this.commands.push( cmd );
            }
        }

    }

    public addItem ( type: string, data: any, loop?: boolean, callBack?: any ) {
        loop = loop ? loop : false;

        this.commands.push( {
            type : type,
            data : data,
            loop : loop,
            call : callBack,
            fail : 0,
        } );

        this._autoTimer();
    }

    public delItem ( type: string, data: any ) {
        for ( const index in this.commands ) {
            if ( this.commands.hasOwnProperty( index ) ) {
                const cmd = this.commands[ index ];
                if ( cmd.type === type && cmd.data === data ) {
                    if ( this.commands.length > 0 ) {
                        this.commands.splice( index, 1 );
                    }

                    break;	// Loop break
                }
            }
        }

        this._autoTimer();
    }

    public start () {
        debug.fine( 'Start' );

        this.counter = 0;
        this.stopped = false;
        this.Ticker  = setInterval(
            () => {
                this.counter++;
                if ( !this.waiting /*|| this.counter >= parseInt(10000 / this.timeout)*/ ) {
                    this.writeNext();
                }

            },
            this.timeoutMillis
        );
    }

    public stop () {
        debug.fine( 'Stop' );

        clearInterval( this.Ticker );

        this.commands = [];
        this.counter  = 0;
        this.stopped  = true;
        this.waiting  = false;
    }

    public pause () {
        debug.fine( 'Pause' );

        clearInterval( this.Ticker );
    }

    private _autoTimer() {
        if ( this.commands.length > 0 ) {
            if ( this.stopped ) {
                this.start();
            }

        } else {
            this.stop();
        }

    }

}
