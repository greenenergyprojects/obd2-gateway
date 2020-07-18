import { exec } from 'child_process';

// const exec = require('child_process').exec

export interface GitInfo {
    remotes: string [];
    branch: string;
    tag: string;
    hash: string;
    modified: string [];
    submodules: {
        path: string;
        gitInfo: GitInfo;
    } [];
}



function _command (cmd: string, removeLf?: boolean ): Promise<string> {
    return new Promise<string>( (resolve, reject) => {
        exec(cmd, function (err, stdout, stderr) {
            if (err) {
                reject(err);
            } else {
                if (removeLf) {
                    resolve(stdout.split('\n').join(''));
                } else {
                    resolve(stdout);
                }
            }
        });
    });
}


export function short (submodule?: string): Promise<string> {
    const cd = submodule ? 'cd ' + submodule + ';' : '';
    return _command(cd + 'git rev-parse --short HEAD', true);
}

export function long (submodule?: string): Promise<string> {
    const cd = submodule ? 'cd ' + submodule + ';' : '';
    return _command(cd + 'git rev-parse HEAD', true);
}

export function tag (submodule?: string): Promise<string> {
    const cd = submodule ? 'cd ' + submodule + ';' : '';
    return _command(cd + 'git describe --always --tag --abbrev=0', true);
}

export function branch (submodule?: string): Promise<string> {
    const cd = submodule ? 'cd ' + submodule + ';' : '';
    return _command(cd + 'git rev-parse --abbrev-ref HEAD', true);
}

export function remote (submodule?: string): Promise<string []> {
    // return _command('git remote -v', true);
    return new Promise<string []> ( (resolve, reject) => {
        const cd = submodule ? 'cd ' + submodule + ';' : '';
        _command(cd + 'git remote -v').then( (result) => {
            const rv = result.split(/\n/);
            if (rv.length > 0 && rv[rv.length - 1] === '') {
                rv.splice(rv.length - 1, 1);
            }
            resolve(rv);
        }).catch( err => reject(err) );
    });
}

export function status (submodule?: string): Promise<string> {
    const cd = submodule ? 'cd ' + submodule + ';' : '';
    return _command(cd + 'git status');
}

export function lsModified (submodule?: string): Promise<string []> {
    return new Promise<string []> ( (resolve, reject) => {
        const cd = submodule ? 'cd ' + submodule + ';' : '';
        _command(cd + 'git ls-files -m').then( (result) => {
            const rv = result.split(/\n/);
            if (rv.length > 0 && rv[rv.length - 1] === '') {
                rv.splice(rv.length - 1, 1);
            }
            resolve(rv);
        }).catch( err => reject(err) );
    });
}

export function lsSubmodules (submodule?: string): Promise<string []> {
    return new Promise<string []> ( (resolve, reject) => {
        const cd = submodule ? 'cd ' + submodule + ';' : '';
        _command(cd + 'git submodule').then( (result) => {
            const rv = result.split(/\n/);
            if (rv.length > 0 && rv[rv.length - 1] === '') {
                rv.splice(rv.length - 1, 1);
            }
            resolve(rv);
        }).catch( err => reject(err) );
    });
}




export async function getGitInfo (submodule?: string): Promise<GitInfo> {
    return new Promise<GitInfo>( (resolve, reject) => {
        const promisses: Promise<any> [] = [];
        promisses.push(remote(submodule));
        promisses.push(lsSubmodules(submodule));
        promisses.push(branch(submodule));
        promisses.push(long(submodule));
        promisses.push(tag(submodule));
        promisses.push(lsModified(submodule));

        Promise.all(promisses).then( result => {
            const remotes = result.shift();
            const submodules = result.shift();
            const strBranch = result.shift();
            const strHash = result.shift();
            let strTag = result.shift();
            strTag = (strTag === strHash) ? '' : strTag;
            const modifiedFiles = result.shift();
            const rv: GitInfo = {
                remotes: remotes,
                branch: strBranch,
                tag: strTag,
                hash: strHash,
                modified: modifiedFiles,
                submodules: []
            };
            if (submodules.length === 0) {
                resolve(rv);
            } else {
                const smProm: Promise<GitInfo> [] = [];
                const paths: string [] = [];
                for (const sm of submodules) {
                    const sma = sm.split(' ');
                    const smPath = sma[0] === '' ? sma[2] : sma[1];
                    paths.push(smPath);
                    smProm.push(getGitInfo(smPath));
                }
                Promise.all(smProm).then( (smResults) => {
                    for (let i = 0; i < smResults.length; i++) {
                        rv.submodules.push({ path: paths[i], gitInfo: smResults[i] });
                    }
                    resolve(rv);

                }).catch( err => reject(err));
            }
        }).catch( err => reject(err) );
    });

}
