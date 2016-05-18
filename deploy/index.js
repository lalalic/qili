#!/usr/bin/env node

var exec = require('ssh-exec'),
	env=process.env,
	stream=exec('bash',{	
		user: env.DEPLOY_USER,
		host: env.DEPLOY_HOST,
		password: env.DEPLOY_PASSWORD
	});
	
stream.write(`
cd /data/qili
git pull
cd deploy
IMAGE_ROOT=registry.mirrors.aliyuncs.com/library/ docker-compose restart`)

stream.pipe(process.stdout)