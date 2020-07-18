export const VERSION = '0.2.0';

import * as nconf from 'nconf';
import * as fs from 'fs';
import * as path from 'path';

import * as git from './utils/git';

process.on('unhandledRejection', (reason, p) => {
    const now = new Date();
    console.log(now.toLocaleDateString() + '/' + now.toLocaleTimeString() + ': unhandled rejection at: Promise', p, 'reason:', reason);
    // debugger;
});



// ***********************************************************
// configuration, logging
// ***********************************************************

nconf.argv().env();
const configFilename = path.join(__dirname, '../config.json');
try {
    fs.accessSync(configFilename, fs.constants.R_OK);
    nconf.file(configFilename);
} catch (err) {
    console.log('Error on config file ' + configFilename + '\n' + err);
    process.exit(1);
}

let debugConfig: any = nconf.get('debug');
if (!debugConfig) {
    debugConfig = { enabled: '*::*' };
}
for (const a in debugConfig) {
    if (debugConfig.hasOwnProperty(a)) {
        const name: string = (a === 'enabled') ? 'DEBUG' : 'DEBUG_' + a.toUpperCase();
        if (!process.env[name] && (debugConfig[a] !== undefined || debugConfig[a] !== undefined)) {
            process.env[name] = debugConfig[a] ? debugConfig[a] : debugConfig[a];
        }
    }
}

// logging with debug-sx/debug
import * as debugsx from 'debug-sx';
const debug: debugsx.IDefaultLogger = debugsx.createDefaultLogger('main');

// debugsx.addHandler(debugsx.createConsoleHandler('stdout'));
debugsx.addHandler(debugsx.createRawConsoleHandler());

const logfileConfig = nconf.get('logfile');
if (logfileConfig) {
    for (const att in logfileConfig) {
        if (!logfileConfig.hasOwnProperty(att)) { continue; }
        const logHandlerConfig = logfileConfig[att];
        if (logHandlerConfig.disabled) { continue; }
        const h = debugsx.createFileHandler( logHandlerConfig);
        console.log('Logging ' + att + ' to ' + logHandlerConfig.filename);
        debugsx.addHandler(h);
    }
}


// ***********************************************************
// startup of application
//   ... things to do before server can be started
// ***********************************************************

import { sprintf } from 'sprintf-js';
import { Server } from './server';
import { OBD2 } from './obd2/obd2';
import { domainToASCII } from 'url';

// debugger;
doStartup().then( () => {
    main().catch( err2 => debug.warn('main fails\n%e', err2));
}).catch( err => debug.warn('startup fails\n%e', err) );

async function doStartup () {
    debug.info('Start of program V' + VERSION);
    try {
        if (nconf.get('git')) {
            const gitInfo = await git.getGitInfo();
            startupPrintVersion(gitInfo);
        }

        await startupParallel();
        await startupServer();
        doSomeTests();
        process.on('SIGINT', () => {
            console.log('...caught interrupt signal');
            shutdown('interrupt signal (CTRL + C)').catch( (err) => {
                console.log(err);
                process.exit(1);
            });
        });
        debug.info('startup finished, enter now normal running mode.');

    } catch (err) {
        console.log(err);
        console.log('-----------------------------------------');
        console.log('Error: exit program');
        process.exit(1);
    }
}

// setTimeout( () => { modbus.close(); }, 5000);

// ***********************************************************
// startup and shutdown functions
// ***********************************************************

async function shutdown (src: string): Promise<void> {
    debug.info('starting shutdown ... (caused by %s)', src || '?');
    const shutdownMillis = +nconf.get('shutdownMillis');
    const timer = setTimeout( () => {
        console.log('Some jobs hanging? End program with exit code 1!');
        process.exit(1);
    }, shutdownMillis > 0 ? shutdownMillis : 500);
    let rv = 0;

    try { await Server.Instance.stop(); } catch (err) { rv++; console.log(err); }
    try { await OBD2.getInstance().shutdown(); } catch (err) { rv++; console.log(err); }
    debug.fine('monitor shutdown done');

    clearTimeout(timer);
    debug.info('shutdown successfully finished');
    process.exit(rv);
}

function startupPrintVersion (info?: git.GitInfo) {
    console.log('main.ts Version ' + VERSION);
    if (info) {
        console.log('GIT: ' + info.branch + ' (' + info.hash + ')');
        const cnt = info.modified.length;
        console.log('     ' + (cnt === 0 ? 'No files modified' : cnt + ' files modified'));
    }
}

async function startupParallel (): Promise<any []> {
    const p = OBD2.createInstance();
    debug.info('startupParallel finished');
    return [ p ];
}

async function startupServer (): Promise<void> {
    const configServer = nconf.get('server');
    if (configServer && configServer.start) {
        await Server.Instance.start();
    }
}

async function startupShutdown (src?: string): Promise<void> {
    const shutdownMillis = +nconf.get('shutdownMillis');
    if (shutdownMillis > 0) {
        setTimeout( () => {
            shutdown(src ? src : 'startupShutdown').then( () => {
                console.log('shutdown successful');
                process.exit(0);
            }).catch( err => {
                console.log(err);
                console.log('shutdown fails');
                process.exit(1);
            });
        }, shutdownMillis);
        debug.info('startupShutdown finished, shutdown in ' + (shutdownMillis / 1000) + ' seconds.');
    }
}

async function doSomeTests () {
    return;
}

async function main () {
    debug.info('main started');
    try {
        await OBD2.getInstance().start();
        // await OBD2.getInstance().listDTC();

    } catch (err) {
        debug.warn('main fails', err);
    }
}
