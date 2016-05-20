var fs=require("fs"),
	env=process.env,
	argv=process.argv,
	src=argv[2] || '.travis.deploy.sh',
	target=argv[3] || src
	

function decode(a){
	if(a && a[0]=="'")
		return a.sustring(1,a.length-2)
	return a
}

var cmds=fs.readFileSync(src,{encoding:"utf8"}).replace(/\${(.*?)}/gm,(a,key)=>decode(env[key])||"")

fs.writeFileSync(target,cmds,"utf8")