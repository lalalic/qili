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
		ACCESS_KEY:env.QINIU_ACCESS_KEY||"test",
		SECRET_KEY:env.QINIU_SECRET_KEY||"test",
		expires:env.QINIU_EXPIRES || 600,
	},
	ali:{
		ACCESS_KEY:env.ALI_ACCESS_KEY,
		SECRET_KEY:env.ALI_SECRET_KEY,
		sms:{
			SIGN_NAME:env.ALI_SMS_SIGN_NAME||"papazai网",
			TEMPLATE_CREATE:env.ALI_SMS_TEMPLATE_CREATE
		}
	},
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
	api: env.API, //qiniu need it, if you don't use file, ignore it
	cloud:{
		timeout: env.CLOUD_TIMEOUT || 3000
	},
	wechat:{
		token: env.WECHAT_TOKEN||'myqili'//wechat api token, ignore it without wechat integration
	},


	secret: env.SECRET || "abcdef",
	root: env.ROOT || "root",
	rootPassword:env.PASSWORD || "root",
	adminKey: env.ADMIN_KEY || "qiliAdmin",
}
