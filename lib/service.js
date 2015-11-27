"use strict"
var mongo=require("mongodb"),
	ObjectID=mongo.ObjectID,
	config=require("../conf");

class Service{
	constructor(req, res){
		this.app=req.application
		this.user=req.user
		this.cloudReq={user:req.user}
		this.cloudRes={
			success: function(o){
				Service.send(res, o)
			},
			error: function(error){
				Service.error(res)(error)
			}
		}
	}
	getMongoServer(){
		return new mongo.Server(config.db.host, config.db.port, {'auto_reconnect':true,safe:true})
	}
	getCloudCode(){
		var Module=module.constructor,
			filename=__dirname+"/_app/"+this.app.name+".js",
			appModule=Module._cache[filename];
		if(!appModule || appModule.updatedAt!=this.app.updatedAt){
			var cloud=require("./cloud").load(this.app,this.user,filename);
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
}

Object.assign(module.exports=Service,{
	config,
	routes:{},
	init(){
		this._makeRoute(this.routes)
	},
	_makeRoute(routes){
		var app=require("../server").app;
		routes && routes.forEach((handler, key)=>{
			var info=key.split(" "),
				verb=info[0],
				path=info.length>1 ? info[1] :"",
				root=this.url ? this.url : "/"+this.prototype.kind,
				url=/^\//.test(path) ? path : (/\/$/.test(root)||path.length==0 ? root : root+"/")+path;
			if('function'!=typeof(handler))
				handler=(req,res)=>this.send(res,req.path)

			app[verb](url,(req, res, next)=>{
				try{
					if(req.params.id)
						req.params.id=this.asObjectId(req.params.id);

					this.checkUrl(req,res)
					this.checkApp(req.application);
					req.application.logs || (req.application.logs=[])
					handler.call(this,req, res, next)
				}catch(error){
					this.error(res)(error)
				}
			})
			console.log("added route: "+verb+" "+url)
		})
		console.log("\n\r")
	},
	checkUrl(){},
	checkApp(app){
		if(!app)
			this.noSupport()
	},
	send(res, data){
		if(res.ended) return;
		res.ended=true

		res.type('json');
		res.send(data||{})
	},
	error(res){
		return function(error){
			if(res.ended) return;
			res.ended=true

			res.status(400).send(error.message||error);
		}
	},
	noSupport(){
		throw new Error("No hack.")
	},
	asObjectId(id){
		if(arguments.length==0)
			return new ObjectID()

		try{
			return ObjectID(id)
		}catch(e){
			return id
		}
	}
})
