const App=require("./app")
const mongo=require("mongo")
const Config=require("../conf")
const _app={}

export default class Admin extends App{
    static resolveAppKey(apiKey){
        if(_apps[apiKey])
			return Promise.resolve(_apps[apiKey])
		else
			return new Promise((resolve,reject)=>this.getAdminDB({w:0}).open((error,db)=>{
				db.collection('apps').find({apiKey}).toArray((error,apps)=>{
					db.close()

					if(error){
						reject(err)
					}else if(apps.length>0){
						let app=apps[0]
						_apps[app.apiKey]=app
						resolve(app)
					}else
						reject(new Error("Applicatio doesn't exist:"+apiKey))
				})
			}))
    }

    static getAdminDB(){
        return new mongo.Db(this.config.adminKey, this.prototype.getMongoServer.call(),option||{w:0})
    }

    static resolve(){
        this.getAdminDB({w:1}).open((error,db)=>{
			db.collection('apps').find().toArray(function(error,apps){
				db.close(error=>{
					if(apps.length==0){
						var service=new AppMan({application:null, user:null})
						service.db=db;
						service.targetAppPromise=Promise.resolve(db)
						service.makeSchema(Object.assign({},config.DEFAULT_SCHEMA)).then(()=>{
							console.info("indexes are updated")
							var now=new Date(),
								adminUser={
									_id: config.root,
									username: config.root,
									password: require("./user").prototype.encrypt(config.rootPassword),
									createdAt: now
								},
								adminApp={
									_id: config.adminKey,
									apiKey: config.adminKey,
									token: Application.asObjectId(),
									name: "admin",
									author: {
										_id: adminUser._id,
										username: adminUser.username
									},
									createdAt: now
								}

							service.importData({users:[adminUser],apps:[adminApp]}).then(()=>{
								console.info("initial data is imported")
								_apps[adminApp.apiKey]=adminApp
							},console.error)

						})
					}else {
						apps.forEach((a)=>{
							_apps[a.apiKey]=a
							console.log(`cached application[${a.name}]`)
						})
					}
				})
			})
		})
        return (req, res, next)=>{
			var apiKey=req.header('X-Application-Id')||req.headers['X-Application-Id']||req.query['X-Application-Id']
			return this.resolveAppKey(apiKey)
				.then(app=>{
					req.application=app
					next()
				},error=>{
					if(this.config.debug){
						console.info(`there are apps with keys: ${Object.keys(_apps).join(",")}`)
						console.dir({url:req._parsedUrl, body:req.body, headers:req.headers})
					}
					next(error)
				})
		}
    }
}
