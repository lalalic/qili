var env=process.env

module.exports={
	version:"1",
	debug: env.DEBUG || false,
	db : {
		port : env.DB_PORT || 27017,
		host : env.DB_HOST || "qili.db"
	},
	server : {
		port : 9080,
		https : 9443,
		timeout : 120
	},
	qiniu:{
		ACCESS_KEY:env.QINIU_ACCESS_KEY,
		SECRET_KEY:env.QINIU_SECRET_KEY,
		bucket:env.QINIU_BUCKET,
		accessURL:env.QINIU_ACCESS_URL,
		expires:env.QINIU_EXPIRES || 600,
	},
	ali:{
		ACCESS_KEY:env.ALI_ACCESS_KEY||"8me1cCfFgeU9uB9W",
		SECRET_KEY:env.ALI_SECRET_KEY||"7UyMNSJmqVCC8YTOZR8kZpT4KORt6s",
		sms:{
			SIGN_NAME:env.ALI_SMS_SIGN_NAME||"papazai网",
			TEMPLATE_RESET: env.ALI_SMS_TEMPLATE_RESET,
			TEMPLATE_CREATE:env.ALI_SMS_TEMPLATE_CREATE||"SMS_39690001"
		}
	},
	domain: env.DOMAIN, //qiniu need it, if you don't use file, ignore it
	cloud:{
		timeout: env.CLOUD_TIMEOUT || 3000
	},
	appRoot: env.APPS_ROOT || `${__dirname}/test/apps`,
	wechat:{
		token: env.WECHAT_TOKEN||'myqili'//wechat api token, ignore it without wechat integration
	},


	secret: env.SECRET || "abcdef",
	root: env.ROOT || "root",
	rootPassword:env.PASSWORD || "root",
	adminKey: env.ADMIN_KEY || "qiliAdmin",

	sharedModules:"backbone,ajax".split(","),
	Internal_API:["users,roles,files,logs".split(",")],
	DEFAULT_SCHEMA: {
		users:[{username:1, $option:{unique:true}},{email:1, $option:{unique:true, sparse:true}}],
		roles:[{name:1, $option:{unique:true}}],
		apps:[{'author._id':1,'name':1, $option:{unique:true}}],
		logs:[{level:1}, {'message.path':1, $option:{name:'accesspath', spare:true}}],
		files:[{'entity.kind':1,'entity._id':1, $option:{name:'entity', spare:true}}]
	}
}
