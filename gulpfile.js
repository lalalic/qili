var gulp=require('gulp'),
    shell=require('gulp-shell'),
    isWin=/^win/.test(process.platform);

gulp.task('javascript', shell.task('./node_modules/.bin/babel --stage 0 src --out-dir dist'))
    .task('run', [], shell.task('node --debug=5858 server.js'))
    .task('inspect', shell.task('node-inspector'))
    .task('test', shell.task('jasmine'))
    .task('debugTest', shell.task('node --debug-brk=5959 /usr/local/bin/jasmine'))
    .task('default',['run','inspect'])
    .task('mongo.docker', shell.task('docker run --name qili.db -p 27017:27017 -v /data/db:/data/db -d registry.mirrors.aliyuncs.com/library/mongo:3.1  --storageEngine=wiredTiger --directoryperdb'))
    .task('app.docker', shell.task([
            'docker build --quiet=true --rm=true --tag="qili"',
            'docker run --name qili -p 9080:9080 -v /data/qili/conf.js:/usr/src/app/conf.js --link qili.db:qili.db -d qili']))
    .task('nginx.docker', shell.task('docker run --name qili.proxy -v /data/nginx/nginx.conf:/etc/nginx/nginx.conf -p 80:80 --link qili:qili -d registry.mirrors.aliyuncs.com/library/nginx'))
