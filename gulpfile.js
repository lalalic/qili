var gulp=require('gulp'),
    shell=require('gulp-shell'),
    isWin=/^win/.test(process.platform);

gulp.task('javascript', shell.task('./node_modules/.bin/babel src --out-dir dist'))
    .task('run', [], shell.task('node --debug=5858 server.js'))
    .task('inspect', shell.task('node-inspector'))
    .task('test', shell.task('jasmine'))
    .task('debugTest', shell.task('node --debug-brk=5959 jasmine'))
    .task('default',['run','inspect'])
