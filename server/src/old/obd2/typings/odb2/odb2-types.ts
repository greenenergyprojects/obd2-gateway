
export interface OBD2_IReplyParseCommand {
    value: string;
    name: string;
    mode: string;
    pid: string;
    min: number;
    max: number;
    unit: string;
}

export interface OBD2_SerialInterface {
    // Base commands
    connect? ( callBack: any ): void;
    disconnect? ( callBack: any ): void;
    write? ( data: string, callBack?: any ): void;
    drain? ( data: string, callBack?: any ): void;
    readWrite? ( data: string, callBack: any, timeout?: number ): void;

    onData? ( callback: any ): void;

    setSerial? ( serial: any ): void;
    getSerial? (): any;

    setPort? ( port: string ): void;
    getPort? (): string;

    setOptions? ( options: any ): void;
    getOptions? (): any;


    isOpen? (): boolean;
    // Event handler
    on? ( type: string, cb?: any ): void;
    // removeListener?( type : string, cb? : any );
}
