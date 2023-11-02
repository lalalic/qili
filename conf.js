process.on('SIGINT',()=>process.exit(0))
process.on('SIGTERM',()=>process.exit(0))
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});
  
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const fs=require("fs")
let env=process.env

function autoCollectApps(appRoot){
	if(!appRoot || !fs.existsSync(appRoot)){
		console.log('no APPS_ROOT')
		return {}
	}

	const apps=fs.readdirSync(appRoot).reduce((apps, a)=>{
		if(fs.statSync(`${appRoot}/${a}`).isDirectory()){
			if(fs.existsSync(`${appRoot}/${a}/qili.conf.js`)){
				const conf=require(`${appRoot}/${a}/qili.conf.js`)
				apps[a]=applyConfFromEnv(a, conf)
			}
		}
		return apps
	},{})
	const keys=Object.keys(apps)
	keys.length>0 && console.log(`found ${keys.length} apps: ${keys.join(",")}`)
	return apps
}

function applyConfFromEnv(apiKey, conf){
	Object.entries(env).forEach(([key, value])=>{
		if(key.startsWith(`${apiKey}.`)){
			const [,confKey]=key.split(".")
			if(!(confKey in conf)){
				conf[confKey]=value
			}
		}
	})
	return conf
}

module.exports={
	version:"1",
	debug: env.DEBUG,
	//keep it secret
	secret: env.SECRET,
	//root user name and password to manage applications
	root: env.ROOT ,
	rootPassword:env.PASSWORD,
	//admin application slug
	adminKey: env.ADMIN_KEY,

	www:env.WWW,

	/**
	 * mongo database host and port
	 */
	db : {
		port : env.DB_PORT || 27017,
		host : env.DB_HOST
	},

	/**
	 * server service port
	 */
	server : {
		port : env.PORT||9080,
		timeout : 50000
	},


	/**
	 * qili use qiniu.com as storage provider
	 */
	qiniu:{
		ACCESS_KEY:env.QINIU_ACCESS_KEY,
		SECRET_KEY:env.QINIU_SECRET_KEY,
		expires:env.QINIU_EXPIRES || 600,
	},
	api: env.API, //qiniu need it, if you don't use file, ignore it

	/**
	 * qili use ali sms service to send verification code
	 */
	ali:{
		ACCESS_KEY:env.ALI_ACCESS_KEY,
		SECRET_KEY:env.ALI_SECRET_KEY,
		sms:{
			SIGN_NAME:env.ALI_SMS_SIGN_NAME,
			TEMPLATE_CREATE:env.ALI_SMS_TEMPLATE_CREATE
		}
	},

	/**
	 * wechat api token, ignore it without wechat integration
	 */
	wechat:{
		token: env.WECHAT_TOKEN
	},
	
	/**
	 * Not used
	 */
	email:{
		host: "",
		port: 587,
		from: "",
		secure: false,
		auth:{
			user: "",
			pass: ""
		}
	},
	
	log:{
		dir:env.LOG_DIR||"./log",
		category:env.LOG_CATEGORY||"default",
	},
	cloud:{
		timeout: env.CLOUD_TIMEOUT || 5000,
		__installDir:require("path").resolve(env.APPS_ROOT||"./apps"),
		__unsupportedModules:["fs", "path", "process", "vm", "domain", "dns", "debugger"],
		__requireExcludes:["graphql-redis-subscriptions"],
		/** 
		 * to config app's www root and cloud code
		 * code file is watched 
		test:{
			root:"/usr/root/test/www",
			code:"/usr/root/test/index.js",
			isDev:true,
			canRunInCore:true,
			bucket:"mytest",//qiniu bucket,
			appUpdates:{
				UPDATES:`/usr/root/test/www/updates`,
				HOSTNAME({runtimeVersion, platform, assetFilePath}){
					const [,uri]=assetFilePath.split(runtimeVersion)
					return `http://localhost:9080/1/test/static/updates/${runtimeVersion}/${uri}`
				}
			},
		}
		*/
	},
	applyConfFromEnv//internal for dev
}

Object.assign(module.exports.cloud,autoCollectApps(module.exports.cloud.__installDir))


