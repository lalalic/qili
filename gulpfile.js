var gulp=require('gulp'),
    shell=require('gulp-shell'),
    isWin=/^win/.test(process.platform);

gulp.task('compile', shell.task('./node_modules/.bin/babel --stage 0 src --out-dir dist'))
    .task('product', shell.task('node server.js'))

    .task('debug', shell.task('node --debug=5858 server.js'))
    .task('inspect', shell.task('node-inspector'))
    .task('test', shell.task('jasmine'))
    .task('debugTest', shell.task('node --debug-brk=5959 /usr/local/bin/jasmine'))

    .task('default',['debug','inspect'])


    .task('mongo.docker', shell.task('docker run --name qili.db -p 27017:27017 -v /data/db:/data/db -d mongo  --storageEngine=wiredTiger --directoryperdb'))
    .task('app.docker', shell.task([
            'docker build --quiet=true --rm=true --tag="qili" .',
            /* db.host=qili.db*/
            'docker run --name qili.server -p 9080:9080 -v /data/qili/conf.js:/usr/src/app/conf.js --link qili.db -d qili']))
    .task('nginx.docker', shell.task(
        /**/
        'docker run --name qili.proxy -v /data:/data -v /data/qili/nginx.conf:/etc/nginx/nginx.conf  -p 80:80 -p 443:443 --link qili.server -d nginx'))
    /* pre:
     * docker images: mongo, nginx, /data/[qili|data|log/nginx]
     * */
    .task('run.docker',['app.docker','mongo.docker','nginx.docker'])
