const mongo=require("mongodb")
const ObjectID=mongo.ObjectID
const config=require("../conf")

class Service{
	constructor(req, res){
		this.app=req.application
		this.user=req.user
		this.cloudReq={user:req.user}
		this.cloudRes={
			success: (o)=>{
				this.constructor.send(res, o)
			},
			error: (error)=>{
				this.constructor.error(res)(error)
			}
		}
		this._logs=[]
	}
	getMongoServer(){
		return new mongo.Server(config.db.host, config.db.port, {'auto_reconnect':true,safe:true})
	}
	getCloudCode(){
		var Module=module.constructor,
			filename=__dirname+"/_app/"+this.app.apiKey+".js",
			appModule=Module._cache[filename];
		if(!appModule || appModule.updatedAt!=this.app.updatedAt){
			var cloud=require("./cloud").load(this,filename);
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

	log(message,level){
		level=level||message.level||0
		if((this.app.logLevel||0)<=level)
			this._logs.push({createdAt:new Date(), message, level})
	}

	finish(){

	}

	get console(){
		return {
			log:m=>this.log(m,0),
			info:m=>this.log(m,0),
			warn:m=>this.log(m,1),
			error:m=>this.log(m,2)
		}
	}
}

Object.assign(module.exports=Service,{
	config,
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
	asObjectId(id){//always as string
		if(arguments.length==0)
			return new ObjectID().toHexString();
		return id;

		try{
			return ObjectID(id)
		}catch(e){
			return id
		}
	}
})
