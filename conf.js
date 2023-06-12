var env=process.env

module.exports={
	version:"1",
	debug: env.DEBUG || false,
	//keep it secret
	secret: env.SECRET || "abcdef",
	//root user name and password to manage applications
	root: env.ROOT || "root",
	rootPassword:env.PASSWORD || "root",
	//admin application slug
	adminKey: env.ADMIN_KEY || "qiliAdmin",

	www:"www",

	/**
	 * mongo database host and port
	 */
	db : {
		port : env.DB_PORT || 27017,
		host : env.DB_HOST || "qili.db"
	},

	//db: "data"

	/**
	 * server service port
	 */
	server : {
		port : 9080,
		https : 9443,
		timeout : 120
	},


	/**
	 * qili use qiniu.com as storage provider
	 */
	qiniu:{
		ACCESS_KEY:env.QINIU_ACCESS_KEY,
		SECRET_KEY:env.QINIU_SECRET_KEY,
		expires:env.QINIU_EXPIRES || 600,
	},
	api: env.API||"https://api.qili2.com/1/graphql", //qiniu need it, if you don't use file, ignore it

	/**
	 * qili use ali sms service to send verification code
	 */
	ali:{
		ACCESS_KEY:env.ALI_ACCESS_KEY,
		SECRET_KEY:env.ALI_SECRET_KEY,
		sms:{
			SIGN_NAME:env.ALI_SMS_SIGN_NAME||"papazai网",
			TEMPLATE_CREATE:env.ALI_SMS_TEMPLATE_CREATE
		}
	},

	/**
	 * wechat api token, ignore it without wechat integration
	 */
	wechat:{
		token: env.WECHAT_TOKEN||'myqili'
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
		/** 
		 * to config app's www root and cloud code
		 * code file is watched 
		admin:{
			root:"/usr/root/www",
			code:"/usr/root/test.js"
		}
		*/
		parrot:{
			root:`${__dirname}/../parrot/cloud/resources`,
			code:`${__dirname}/../parrot/cloud/index.js`,
			isDev:true,
			canRunInCore:true,
			//storage:"http://localhost:9080/1/parrot/static/upload",
			bucket:"qiliadmin",
		}
	}
}
