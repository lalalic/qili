var _=require("underscore"),
	mongo=require("mongodb"),
	config=require("../conf"),
	me;

_.extend((me=module.exports=_.extend(function(req, res){
			this.app=req.application
			this.user=req.user
			this.cloudReq={user:req.user}
			this.cloudRes={
				success: function(o){
					me.send(res, o)
				},
				error: function(error){
					me.error(res)(error)
				}
			}
	},{
	config: config,
	routes:{},
	extend: function(protoProps, staticProps) {
		var parent = this;
		var child;

		// The constructor function for the new subclass is either defined by you
		// (the "constructor" property in your `extend` definition), or defaulted
		// by us to simply call the parent's constructor.
		if (protoProps && _.has(protoProps, 'constructor')) {
		  child = protoProps.constructor;
		} else {
		  child = function(){ return parent.apply(this, arguments); };
		}

		// Add static properties to the constructor function, if supplied.
		_.extend(child, parent, staticProps);

		// Set the prototype chain to inherit from `parent`, without calling
		// `parent`'s constructor function.
		var Surrogate = function(){ this.constructor = child; };
		Surrogate.prototype = parent.prototype;
		child.prototype = new Surrogate;

		// Add prototype properties (instance properties) to the subclass,
		// if supplied.
		if (protoProps) _.extend(child.prototype, protoProps);

		// Set a convenience property in case the parent's prototype is needed
		// later.
		child.__super__ = parent.prototype;

		return child;
	  },
	init: function(){
		this._makeRoute(this.routes)
	},
	_makeRoute: function(routes){
		var app=require("../server").app;
		_.each(routes,function(handler, key){
			var info=key.split(" "),
				verb=info[0],
				path=info.length>1 ? info[1] :"",
				root=this.url ? this.url : "/"+this.prototype.kind,
				url=/^\//.test(path) ? path : (/\/$/.test(root)||path.length==0 ? root : root+"/")+path;
			if(!_.isFunction(handler))
				handler=function(req,res){
					this.send(res,req.path)
				}.bind(this);
			app[verb](url,function(req, res, next){
				try{
					this.checkUrl(req,res)
					this.checkApp(req.application);
					req.application.logs || (req.application.logs=[])
					handler.call(this,req, res, next)
				}catch(error){
					this.error(res)(error)
				}
			}.bind(this))
			console.log("added route: "+verb+" "+url)
		},this)
		console.log("\n\r")
	},
	checkUrl:function(){},
	checkApp:function(app){
		if(!app)
			this.noSupport()
	},
	send: function(res, data){
		if(res.ended) return;
		res.ended=true

		res.type('json');
		res.send(data||{})
	},
	error: function(res){
		return function(error){
			if(res.ended) return;
			res.ended=true

			res.status(400).send(error.message||error);
		}
	},
	noSupport: function(){
		throw new Error("No hack.")
	}
})).prototype,{
	getMongoServer: function(){
		return new mongo.Server(config.db.host, config.db.port, {'auto_reconnect':true,safe:true})
	},
	getCloudCode: function(){
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
	},
	isAbleTo: function(doc, caps){
		return true
	}
})
