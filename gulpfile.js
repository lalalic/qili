var gulp=require('gulp'),
    shell=require('gulp-shell')
gulp.task('default', shell.task('node --debug=5858 server.js'))
    .task('test', shell.task('jasmine'))
    .task('test.debug', shell.task('node --debug-brk=5959 ./node_modules/.bin/jasmine'))
    .task('mongo', shell.task('mongod  --storageEngine=wiredTiger --directoryperdb --dbpath="mongo/"'))


    .task('docker.mongo', shell.task([
        'docker run --name qili.db.test --link qili.db -it mongo mongo qili.db',//mongo console
        'docker run --name qili.db -p 27017:27017 -v /data/db:/data/db -d mongo  --storageEngine=wiredTiger --directoryperdb']))
    .task('docker.app', shell.task([
            //update source code, node-inspector, and test
            /* db.host=qili.db*/
            'docker run --name qili.server -v /data:/data --workdir /data/qili -p 9080:9080 -p 8080:8080 --link qili.db -d node node_modules/.bin/node-debug --no-debug-brk --no-prelead server.js']))
    .task('docker.nginx', shell.task(
        'docker run --name qili.proxy -v /data:/data -v /data/qili/nginx.conf:/etc/nginx/nginx.conf  -p 80:80 -p 443:443 --link qili.server -d nginx'))
    /* pre:
     * docker images: mongo, nginx, /data/[qili|data|log/nginx]
     * */
    .task('docker.run',['app.docker','mongo.docker','nginx.docker'])
