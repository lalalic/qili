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
		ACCESS_KEY:env.QINIU_ACCESS_KEY||"1o_JaGUUb8nVxRpDGoAYB9tjLT10WD7PBFVtMmVT",
		SECRET_KEY:env.QINIU_SECRET_KEY||"r2nd182ZXzuCiCN7ZLoJPFVPZHqCxaUaE73RjKaW",
		expires:env.QINIU_EXPIRES || 600,
	},
	api: env.API||"https://api.wenshubu.com/1/graphql", //qiniu need it, if you don't use file, ignore it

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
	
	cloud:{
		timeout: env.CLOUD_TIMEOUT || 5000,
	},
	log:{
		dir:env.LOG_DIR||"./log",
		category:env.LOG_CATEGORY||"default",
	},
	dev({clientPort=9081,serverPort=parseInt(`1${clientPort}`), cloudCodeFile, appId}={}){
		this.server.port=serverPort
		console.debug(`Qili Dev Server is on localhost:${serverPort}`)
		this.www=require("express-http-proxy")(`localhost:${clientPort}`,{
			filter(req,res){
				if(req.url=="/app.apk.version"){
					res.send('1.0.x')
					return false
				}
				console.debug(`redirecting to ${req.url}`)
				return true
			}
		})
		
		if(cloudCodeFile){
			appId=appId||this.adminKey
			const fs=require("fs")
			let cloudCode=""
			
			Object.defineProperties(this,{
				cloudCode:{
					get(){
						if(!cloudCode){
							cloudCode=fs.readFileSync(cloudCodeFile,{encoding:"utf-8"})
							fs.watchFile(cloudCodeFile,(event)=>{
								if(event=="change"){
									require("./lib/app").Cache.remove(appId)
									cloudCode=fs.readFileSync(cloudCodeFile,{encoding:"utf-8"})
								}
							})
						}
						return cloudCode
					}
				}
			})
		}
		require('node:child_process').exec(`mkdir _data_`)
		const mongo=require('node:child_process').spawn("mongod",["--storageEngine=wiredTiger", "--directoryperdb", `--dbpath="_data_"`],{stdio:'inherit'})

		require("./lib")
		require('node:child_process').exec(`open http://localhost:${serverPort}`)
		return mongo
	}
}
