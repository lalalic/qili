#!/usr/bin/env node

var exec = require('ssh-exec'),
	env=process.env,
	opt={
		user: env.DEPLOY_USER,
		host: env.DEPLOY_HOST,
		password: env.DEPLOY_PASSWORD
	},
	target=env.TARGET_DEPLOY_FILE
var cmds=require("fs").readFileSync(`${__dirname}/start.sh`,{encoding:"utf8"}).replace(/\${(.*?)}/gm,(a,key)=>env[key]||"")

//new file
exec(`echo #${new Date()} > ${target}`,opt).pipe(process.stdout)

cmds.split(/\r?\n/).forEach(a=>{
	exec(`echo "${a}" >> ${target}`).pipe(process.stdout)
})

exec(`chmod u+x ${target}`,opt).pipe(process.stdout)

exec(target,opt).pipe(process.stdout)
