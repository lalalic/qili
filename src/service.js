var _=require("underscore"),
	mongo=require("mongodb");

export default class Main{
	constructor(req, res){
		var self=this.clazz
		if(!self.isHttpRequest(req)){
			this.app=req;
			this.user=res;
		}else{
			this.app=request.application
			this.user=require("./user").resolvSessionToken(req.header("X-Session-Token")||req.query['X-Session-Token'])
			this._req={user:this.user};
			this._res={
				success: function(o){
					self.send(res, o)
				},
				error: function(error){
					self.error(res)(error)
				}
			}
		}
	}

	getMongoServer(){
		var config=require("../server").config
		return new mongo.Server(config.db.host, config.db.port, {'auto_reconnect':true,safe:true})
	}

	getCloudCode(){
		var Module=module.constructor,
			filename=__dirname+"/_app/"+this.app.name+".js",
			appModule=Module._cache[filename];
		if(!appModule || appModule.updatedAt!=this.app.updatedAt){
			var cloud=require("./cloud").load(this.app,filename);
			appModule=new Module(filename);
			appModule.exports=cloud;
			appModule.filename=filename;
			appModule.updatedAt=this.app.updatedAt||this.app.createdAt;
			Module._cache[filename]=appModule;
		}
		return appModule.exports;
	}

	isAbleTo(doc, caps){
		return true
	}

	get clazz(){
		return this.constructor
	}

	static isHttpRequest(req){
		return req && req.header && true
	}

	static get version(){
		return "1"
	}
	static get routes(){
		return {}
	}

	static init(){
		var app=require("../server").app;
		_.each(this.routes,function(handler, key){
			var info=key.split(" "),
				verb=info[0],
				path=info.length>1 ? info[1] :"",
				root=this.url ? this.url : "/"+this.prototype.kind,
				url=/^\//.test(path) ? path : (/\/$/.test(root)||path.length==0 ? root : root+"/")+path;
			if(!_.isFunction(handler))
				handler=function(req,res){
					this.send(res,req.path)
				}.bind(this);
			app[verb]("/"+this.version+url,function(req, res, next){
				try{
					this.checkUrl(req,res)
					require("./app").resolveAppKey(req.header('X-Application-Id')||req.query['X-Application-Id'])
					.then(function(app){
						try{
							this.checkApp(req.application=app);
							(app.logs || (app.logs=[])).push(res.log={
								createdAt:new Date(),
								level:9,
								message:{
									remote:	req.ip||req._remoteAddress||(req.connection&&req.connection.remoteAddress),
									method: req.method,
									path: req.originalUrl || req.url,
									httpVersion: req.httpVersionMajor + '.' + req.httpVersionMinor,
									referrer: req.headers['referer'] || req.headers['referrer'],
									userAgent: req.headers['user-agent']
								}
							})

							handler.call(this,req, res, next)
						}catch(error){
							this.error(res)(error)
						}
					}.bind(this),this.error(res))
				}catch(error){
					this.error(res)(error)
				}
			}.bind(this))
			console.log("added route: "+verb+" "+url)
		},this)
		console.log("\n\r")
	}
	static checkUrl(){

	}

	static checkApp(app){
		if(!app)
			this.noSupport()
	}

	static send(res, data){
		if(res._sended)
			return
		res.header('Content-Type', 'application/json');
		res.log && (res.log.message.status=200)
		res.send(data||{})
		res._sended=true
	}

	static error(res){
		return function(error){
			if(res._sended) return;
			res.log && (res.log.message.status=400)
			res.send(400, error.message||error);
			res._sended=true
		}
	}

	static noSupport(){
		throw new Error("No hack.")
	}
}
