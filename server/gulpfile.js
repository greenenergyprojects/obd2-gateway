// https://www.liquidlight.co.uk/blog/article/how-do-i-update-to-gulp-4/

const fs = require('fs');

const remoteHostname = 'pi-obd';
const remoteTargetDir = '/home/steiner/obd2';
const sshConfig = {
    host: remoteHostname,
    port: 22,
    username: 'steiner',
    privateKey: fs.readFileSync('/home/steiner/.ssh/id_rsa_rpi')
}

console.log('gulp running in folder ' + __dirname);

const gulp         = require('gulp'),
      gChanged     = require('gulp-changed'),
      gReplace     = require('gulp-replace'),
      gRsync       = require('gulp-rsync'),
      gSsh         = require('gulp-ssh'),
      gSourcemaps  = require('gulp-sourcemaps'),
      gTypescript  = require('gulp-typescript'),      
      gUsing       = require('gulp-using');      
      del          = require('del'),
      merge        = require('merge-stream'),
      nconf        = require('nconf'),
      vfs          = require('vinyl-fs');

const gulpDebug = require('gulp-debug');
      
      

const verbose = 0;
let hasError = false;
const sep = '----------------------------------------------------------------------------';
const remoteConfig = nconf.file('remote.json').get();
const tsProject = gTypescript.createProject("tsconfig.json");

var ssh = new gSsh({
    ignoreErrors: false,
    sshConfig: sshConfig
});


gulp.task('clean', function () {
    if (verbose) { console.log("Task clean gestartet"); }
    const toDelete = [ 'dist/*', 'dist_remote/*' ];
    for (let s of toDelete) {
        if (verbose > 1) { console.log(' --> deleting ' + s); }
    }
    return del(toDelete);
});

gulp.task('transpile', function () {
    return gulp.src('src/**/*.ts', { follow: true, followSymlinks: true })
        .pipe(gChanged('dist', { extension: '.js'}))
        .pipe(gUsing( { prefix:'  --> Transpiling file', path:'cwd', color:'green', filesize:false } ))
        .pipe(gSourcemaps.init())
        .pipe(tsProject( { error: myReporter, finish: myFinishHandler } ))
        .pipe(gSourcemaps.mapSources(
            function(sourcePath, file) {
                return sourcePath.substr(0);
            }))
        .pipe(gSourcemaps.write('./', { sourceRoot: __dirname + '/src'} ))
        .pipe(gulp.dest('dist'));
});

gulp.task('copyFiles', function () {
    const copyPugViews =
        gulp.src('src/views/**/*.pug')
            .pipe(gChanged('dist/views', { extension: '.pug' }))
            .pipe(gUsing({prefix:'  --> Copying file', path:'cwd', color:'blue', filesize:false}))
            .pipe(gulp.dest('dist/views/'));

    const copyPublic =
        gulp.src('src/assets/**/*')
            .pipe(gChanged('dist/assets', { }))
            .pipe(gUsing({prefix:'  --> Copying file', path:'cwd', color:'blue', filesize:false}))
            .pipe(gulp.dest('dist/assets/'));

    const copyObd2Data =
        gulp.src('src/obd2/data/**/*')
                .pipe(gChanged('dist/data', { }))
                .pipe(gUsing({prefix:'  --> Copying file', path:'cwd', color:'blue', filesize:false}))
                .pipe(gulp.dest('dist/data/'));

    return merge(copyPugViews, copyPublic, copyObd2Data);
});

gulp.task('dist_remote', function(done) {
    if (remoteConfig && remoteConfig.disabled) {
        if (verbose) {
            console.log('task dist_remote: skipping because remote platform disabled (see file remote.json)');
        }
        done();
        return;
    }
    const rv1 = gulp.src(['dist/**/*.js.map'])
        .pipe(gReplace(__dirname + '/src', remoteTargetDir + '/server/src' ))
        .pipe(gulp.dest('dist_remote/'));

    const rv2 = gulp.src(['dist/**/*.js'])
        .pipe(gulp.dest('dist_remote/'));          

    const rv3 = gulp.src(['src/views/*'])
        .pipe(gulp.dest('dist_remote/views/'));

    return merge(rv1, rv2, rv3);
});

gulp.task('copyToRemote', function(done) {
    if (remoteConfig && remoteConfig.disabled) {
        if (verbose) {
            console.log('task copyToRemote: skipping because remote platform disabled (see file remote.json)');
        }
        done();
        return;
    }

    const rsyncSrc =
        vfs.src('src/**')
            // .pipe(gulpDebug())
            .pipe(gRsync({
                root: 'src/',
                hostname: remoteHostname,
                destination: remoteTargetDir + '/server/src/',
                emptyDirectories: true,
                links: true
            }));

    const rsyncDist =
        gulp.src('dist_remote/**')
            // .pipe(gulpDebug())
            .pipe(gRsync({
                root: 'dist_remote/',
                hostname: remoteHostname,
                destination: remoteTargetDir + '/server/dist/'
        }));

    const rsyncPublic =
        gulp.src('assets/**')
            // .pipe(gulpDebug())
            .pipe(gRsync({
                root: 'assets/',
                hostname: remoteHostname,
                destination: remoteTargetDir + '/server/assets/'
        }));

    const rsyncServerOthers =
        gulp.src(['package.json', 'README*' ], { allowEmpty: true })
            // .pipe(gulpDebug())
            .pipe(gRsync({
                root: './',
                hostname: remoteHostname,
                destination: remoteTargetDir + '/server/'
        }));

    const rsyncProjectOthers =
        gulp.src(['../package.json', '../README*' ], { allowEmpty: true })
            // .pipe(gulpDebug())
            .pipe(gRsync({
                root: '../',
                hostname: remoteHostname,
                destination: remoteTargetDir + '/'
        }));

    const rsyncNgxSrc =
        gulp.src('../ngx/src/**')
            // .pipe(gulpDebug())
            .pipe(gRsync({
                root: '../ngx/',
                hostname: remoteHostname,
                destination: remoteTargetDir + '/ngx/',
                emptyDirectories: true
        }));

    const rsyncNgxDist =
        gulp.src('../ngx/dist/**')
            // .pipe(gulpDebug())
            .pipe(gRsync({
                root: '../ngx/',
                hostname: remoteHostname,
                destination: remoteTargetDir + '/ngx/',
                emptyDirectories: true
        }));

    return merge(rsyncSrc, rsyncDist, rsyncPublic, rsyncServerOthers, rsyncProjectOthers, rsyncNgxSrc, rsyncNgxDist);
});

gulp.task('remoteInit', function (done) {
    const cmds = [];
    cmds.push('test -d ' + remoteTargetDir + ' && mv ' + remoteTargetDir + ' ' + remoteTargetDir + "_$(date +%Y-%m-%d_%H%M%S-%3N)");
    cmds.push('mkdir ' + remoteTargetDir);
    cmds.push('mkdir -p ' + remoteTargetDir + '/server/src');
    return ssh.exec(cmds, {filePath: 'gulp-ssh-commands-init.log'}).pipe(gulp.dest('../logs'));
})

gulp.task('remoteClean', function (done) {
    const cmds = [];
    cmds.push('test -d ' + remoteTargetDir + '/server/dist && rm -r ' + remoteTargetDir + '/server/dist');
    cmds.push('test -d ' + remoteTargetDir + '/ngx/dist && rm -r ' + remoteTargetDir + '/ngx/dist');
    return ssh.exec(cmds, {filePath: 'gulp-ssh-commands-clean.log'}).pipe(gulp.dest('../logs'));
})


gulp.task('remotePlatform', function (done) {
    if (remoteConfig && remoteConfig.disabled) {
        if (verbose) {
            console.log('task remotePlatform: skipping because remote platform disabled (see file remote.json)');
        }
        done();
        return;
    }
    gulp.series(['dist_remote', 'copyToRemote'], function(done2) {
        done2();
        done();
    })();
})

gulp.task('remoteStart', function (done) {
    ssh.shell(
        ['cd ' + remoteTargetDir + '/server', 'killall node', 'nohup node --inspect=0.0.0.0:9229 dist/main.js &']
        //  ['cd ' + remoteTargetDir + '/server', 'killall node', 'nohup node --inspect=0.0.0.0:9229 --inspect-brk=0.0.0.0:9229 dist/main.js &']
        // ['cd ' + remoteTargetDir, 'nodemon --inspect=0.0.0.0:9229 --inspect-brk=0.0.0.0:9229 dist/main.js']
        //, {filePath: 'shell.log'}
    )
    done();
});

gulp.task('cleanAll', gulp.parallel(['clean', 'remoteClean']));
gulp.task('build', gulp.series(['transpile', 'copyFiles']));
gulp.task('buildAndLaunchOnRemote', gulp.series(['build', 'remotePlatform', 'remoteStart' ]));
gulp.task('buildAndCopyToRemote', gulp.series(['build', 'remotePlatform' ]));
gulp.task('start', gulp.series(['build', 'remoteStart']));
gulp.task('default', gulp.series('start'));


const cache = {};

function myReporter (error)  {
    if (cache[error.message]) {
        return;
    }
    cache[error.message] = true;
	  console.log(error.message);
}


function myFinishHandler (results) {
    let msg = sep;

    const showErrorCount = (count, errorTyp) => {
        if (count === 0) {
              return;
        }
        hasError = true;
        msg += '\nTypescript: ' + count.toString() + ' ' + errorTyp + ' errors.';
    }

    showErrorCount(results.transpileErrors, '');
    showErrorCount(results.optionsErrors, 'options');
    showErrorCount(results.syntaxErrors, 'syntax');
	showErrorCount(results.globalErrors, 'global');
	showErrorCount(results.semanticErrors, 'semantic');
	showErrorCount(results.declarationErrors, 'declaration');
	showErrorCount(results.emitErrors, 'emit');

    if (hasError) {
        msg += '\n' + sep;
    }

    if (results.emitSkipped) {
	      msg += '\nTypeScript: emit failed';
  	} else if (hasError) {
		    msg += '\nTypeScript: emit succeeded (with errors)';
	  } else {
        msg += '\nTypeScript: emit succeeded (no errors)';
    }

    finalMessage = msg;
}
