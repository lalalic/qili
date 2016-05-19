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

//new file
exec(`echo "#${new Date()}" > ${target}`,opt).pipe(process.stdout)

cmds.split(/\r?\n/).forEach(a=>{
	exec(`echo "#${a}" >> ${target}`,opt).pipe(process.stdout)
})
exec(`echo "!finish deploying on remote target!" >> ${target}`,opt).pipe(process.stdout)
exec(`chmod u+x ${target}`,opt).pipe(process.stdout)

exec(target,opt).pipe(process.stdout)
