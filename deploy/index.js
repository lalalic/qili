#!/usr/bin/env node

var exec = require('ssh-exec'),
	env=process.env,
	opt={
		user: env.DEPLOY_USER,
		host: env.DEPLOY_HOST,
		password: env.DEPLOY_PASSWORD
	},
	target=env.TARGET_DEPLOY_FILE
function decode(a){
	if(a && a[0]=="'")
		return a.sustring(1,a.length-2)
	return a
}
var cmds=require("fs").readFileSync(`${__dirname}/start.sh`,{encoding:"utf8"}).replace(/\${(.*?)}/gm,(a,key)=>decode(env[key])||"")

exec(`echo "${cmds}" > ${target}`,opt, error=>{
	if(error)
		return;
	exec(`chmod u+x ${target}`,opt, error=>{
		if(error) return;
		exec(target,opt).pipe(process.stdout)
	}).pipe(process.stdout)
}).pipe(process.stdout)
