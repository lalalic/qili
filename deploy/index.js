#!/usr/bin/env node

var exec = require('ssh-exec'),
	env=process.env
//exec('cd /data/qili && git pull && cd deploy && IMAGE_ROOT=registry.mirrors.aliyuncs.com/library/ docker-compose restart', {
exec('ls -a',{	
	user: env.DEPLOY_USER,
	host: env.DEPLOY_HOST,
	password: env.DEPLOY_PASSWORD
}).pipe(process.stdout)