var gulp=require('gulp'),
    shell=require('gulp-shell')
    function download(file){
        require('https').get("https://raw.githubusercontent.com/lalalic/dashboard/master/www/"+file,
            function(response) {
                response.pipe(require('fs').createWriteStream("www/dashboard/"+file));
            });
    }

gulp.task('compile', shell.task('./node_modules/.bin/babel --stage 0 src --out-dir dist'))
    .task('dashboard', function(){download("allin1.html"); download("index.html");download("index.js")})
    .task('debug', shell.task('node --debug=5858 server.js'))
    .task('inspect', shell.task('node-inspector'))
    .task('debugTest', shell.task('node --debug-brk=5959 /usr/local/bin/jasmine'))

    .task('default',['debug','inspect','dashboard'])


    .task('docker.mongo', shell.task('docker run --name qili.db -p 27017:27017 -v /data/db:/data/db -d mongo  --storageEngine=wiredTiger --directoryperdb'))
    .task('docker.app', shell.task([
            'docker build --quiet=true --rm=true --tag="qili" .',
            /* db.host=qili.db*/
            'docker run --name qili.server -p 9080:9080 --link qili.db -d qili']))
    .task('docker.nginx', shell.task(
        'docker run --name qili.proxy -v /data:/data -v /data/qili/nginx.conf:/etc/nginx/nginx.conf  -p 80:80 -p 443:443 --link qili.server -d nginx'))
    .task('docker.test', shell.task(['docker run --name qili.test --link qili.server qili npm test']))
    /* pre:
     * docker images: mongo, nginx, /data/[qili|data|log/nginx]
     * */
    .task('docker.run',['app.docker','mongo.docker','nginx.docker'])
