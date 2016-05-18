#!/usr/bin/env node

var exec = require('ssh-exec'),
	env=process.env,
	opt={
		user: env.DEPLOY_USER,
		host: env.DEPLOY_HOST,
		password: env.DEPLOY_PASSWORD
	}
	//,cmd=require("fs").readFileSync("./start.sh").replace(/\${(.*?)}/gm,(a,key)=>env[key]||"")

exec(env.DEPLOYER,opt).pipe(process.stdout)
