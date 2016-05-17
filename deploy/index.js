#!/usr/bin/env node

var exec = require('ssh-exec'),
	env=process.env
exec('IMAGE_ROOT=registry.mirrors.aliyuncs.com/library/ docker-compose restart', {
	user: env.DEPLOY_USER,
	host: env.DEPLOY_HOST,
	password: env.DEPLOY_PASSWORD
}).pipe(process.stdout)