"use strict"
var Entity=require("./entity"),
	mongo = require("mongodb"),
	_apps={},
	DEFAULT_SCHEMA=JSON.parse(JSON.stringify(require("../data/schema")));

class Application extends Entity{
	get kind(){return "apps"}

	isAbleTo(doc, caps){
		if(doc.author._id!==this.user._id)
			throw new Error("Only owner can update application")
	}
	beforeCreate(doc,collection){
		if(!doc.name)
			return Promise.reject(new Error("application name can't be empty"))
			
		!doc._id && (doc._id=this.constructor.asObjectId());
		doc.apiKey=doc._id
		return Promise.resolve(doc)
	}
	afterCreate(doc, collection){
		_apps[doc._id]=doc
		//default schema
		var schema=Object.assign({},DEFAULT_SCHEMA)
		schema.apps=undefined
		var appMan=new AppMan({application:doc, user:this.user, query:{appman:doc._id.toString()}})
		appMan.makeSchema(schema)

		//write a log to create app database, so it's shown in db console
		appMan.db.open(function(error, db){
			if(error){
				return db.close()
			}
			db.collections("logs",function(error, logs){
				if(error){
					console.error(`Can't drop application [${doc._id}] because of ${err.message}`)
					return db.close()
				}
				logs.insert(Object.assign({message:{text:"Application initialized"}},this.app.logs[0],{level:10}),function(error){
					db.close()
				})
			})
		})
		return Promise.resolve(doc)
	}
	beforeUpdate(doc,collection){
		return this.checkACL(doc,collection,['update'])
			.then((old)=>{
				var attr=doc, changes=attr['$set']||attr,temp;
				if((temp=changes.cloudCode)){
					try{
						new Function("Cloud",temp)
					}catch(error){
						return Promise.reject(error)
					}
				}
				return Promise.resolve()
			})
	}
	afterUpdate(doc, collection){
		_apps[doc._id]=doc
		return Promise.resolve()
	}
	beforeRemove(doc, collection){
		return this.checkACL(doc,collection,['remove'])
	}
	afterRemove(doc, collection){
		delete _apps[doc._id]
		//drop app database
		var theDB=new mongo.Db(doc._id.toString(), this.getMongoServer(),{w:1})
		theDB.open(function(error, db){
			if(error)
				return db.close()

			db.dropDatabase((err)=>{
				if(err)
					console.error(`Can't drop application [${doc._id}] because of ${err.message}`)
				db.close()
			})
		})
		return Promise.resolve()
	}
	get(query, options){
		if(this.user && typeof(query)=='object' && !query._id){
			query['author._id']=this.user._id
		}

		return super.get(query,options)
			.then((doc)=>{
				if(this.user && !Array.isArray(doc) && doc && doc.author._id!=this.user._id)
					return Promise.reject(new Error("no hack"))
				return doc;
			})
	}
}

Object.assign(module.exports=Application,{
	url:"/apps",
	checkApp(app){
		Entity.checkApp(app)
		if(app._id!=this.config.adminKey)
			this.noSupport();
	},
	afterPost(doc){
		var a={};
		['createdAt', 'updatedAt', '_id', 'apiKey'].forEach((k)=>a[k]=doc[k])
		return a
	},
	resolveAppKey(appId){
		return _apps[appId]
	},
	resolve(onlyMiddleware){
		return function(req, res, next){
			var apiKey=req.header('X-Application-Id')||req.headers['X-Application-Id']||req.query['X-Application-Id']
			var app=this.resolveAppKey(apiKey);
			if(app){
				req.application=app
				next()
			}else {
				console.info(`there are apps with keys: ${Object.keys(_apps).join(",")}`)
				if(this.config.debug)
					console.dir({url:req._parsedUrl, body:req.body, headers:req.headers})
				next(new Error("Application doesn't exit"))
			}
		}.bind(this)
	},
	init(){
		Entity.init.apply(this,arguments)
		AppMan.init()

		this.getAdminDB({w:1}).open((error,db)=>{
			db.collection('apps').find().toArray(function(error,apps){
				db.close((error)=>{
					if(apps.length==0){
						var service=new AppMan({application:null, user:null})
						service.db=db;
						service.makeSchema(Object.assign({},DEFAULT_SCHEMA)).then(()=>{
							console.info("indexes are updated")
							var initData=require("../data/init"),
								adminApp=initData.apps[0]
							service.importData(initData).then(()=>{
								console.info("initial data is imported")
								_apps[adminApp._id]=adminApp
							},console.error)
						})
					}else {
						apps.forEach((a)=>_apps[a.apiKey]=a)
					}
				})
			})
		})

		if(this.config.debug){//for test automation
			var testApp=require("../spec/config").testApp
			_apps[testApp._id]=testApp
		}

	}
})


class AppMan extends Entity{
	constructor(req, res){
		super(req,res);
		if(this.app){
			var appman=this.targetApp=module.exports.resolveAppKey(req.query.appman)
			if(!appman)
				this.noSupport();
			this.db = new mongo.Db(appman._id.toString(), this.getMongoServer(),{w:1});
			delete req.query.appman
		}
	}
	dropCollection(name){
		var p=this.dbPromise()
		this.db.open(function(error, db){
			if(error) return p.reject(error);
			db.dropCollection(name,function(error, names){
				if(error) return p.reject(error);
				p.resolve(names)
			})
		})
		return p
	}
	_getCollectionSchema(name, db){
		return new Promise((resolve, reject)=>
			db.collection(name,(error, collection)=>{
				if(error) return reject(error)
				collection.findOne({},(error, doc)=>{
					if(error) return p.reject(error)
					resolve(doc && Object.keys(doc) || [])
				})
			})
		)
	}
	getSchema(){
		var p=this.dbPromise();
		this.db.open((error, db)=>{
			if(error) return p.reject(error);
			db.listCollections().toArray((error, collections)=>{
				if(error) return p.reject(error)

				var now=new Date()
				Promise.all(collections.map((info)=>{
						var name=info.name
						if((name=name.split(".")[0])=='system')
							return false
						return this._getCollectionSchema(info.name, db).then((schema)=>{
								info.fields=schema
								info.createdAt=now
								return info
							})
					}).filter((a)=>a))
					.then((schema)=>p.resolve(schema), (error)=>p.reject(error))
			})
		})
		return p
	}
	makeSchema(indexes){
		indexes && indexes.forEach((items, kind)=>{
			delete indexes[kind]
			var index=indexes[kind]={}
			items && items.forEach((item)=>{
				var name=""
				for(var i in item)
					i!="$option" && (name+=("_"+i+"_"+item[i]))
				index[(item['$option']&&item['$option'].name)||name.substr(1)]=item
			})
		})


		var p=this.dbPromise(),
			_error=(e)=>p.reject(e)

		this.db.open((error, db)=>{
			if(error) return _error(error)
			db.collection("system.indexes",(error, collection)=>{
				collection.find({name:{$ne:"_id_"}}, (error, info)=>{
					info.toArray((error, items)=>{
						Promise.all(items.map((index)=>{
								var kind=index.ns.split('.')[1],
									key=index.key;
								if(!indexes[kind] || !indexes[kind][index.name]){
									return new Promise((resolve,reject)=>db.dropIndex(kind, index.name, (e)=>e ? reject(e):resolve()))
								}else
									delete indexes[kind][index.name]
								return false
						}).filter((a)=>a)).then(()=>{
							var tasks=[]
							indexes && indexes.forEach((items, kind)=>{
								items && items.forEach((key,name)=>{
									var option=key['$option'];
									if(option)
										delete key['$option']

									tasks.push(
										new Promise((resolve, reject)=>
											db.createIndex(kind, key, option||{}, (error,indexName)=>{
												if(error || indexName==null)
													reject(error)
												else
													resolve(kind+"."+name)
											})
										)
									)

								})
							})

							Promise.all(tasks).then((m)=>p.resolve(m), _error)

						}, _error)
					})
				})
			})
		})

		return p
	}
	importData(data){
		var p = this.dbPromise(),
			_error=(e)=>p.reject(e);
		this.db.open((error, db) => {
			if(error) return p.reject(error)
			Promise.all(Object.keys(data).map((kind)=>
				new Promise((resolve, reject)=>
					db.collection(kind, (error, collection)=> {
						if(error) return reject(error)
						collection.insert(data[kind], (e)=>e?reject(e):resolve())
					})
				)
			)).then(()=>p.resolve(),(e)=>p.reject(e))
		})//db.open
		return p
	}
	getIndexes(){
		var p=this.dbPromise()
		this.db.open(function(error, db){
			if(error) return p.reject(error)
			db.collection("system.indexes",function(error, collection){
				collection.find({name:{$ne:"_id_"}}, function(error, info){
					if(error) return p.reject(error)
					info.toArray(function(error, items){
						if(error) return p.reject(error)
						var indexes={}
						items && items.forEach((index)=>{
							var kind=index.ns.split('.')[1],
								key=index.key;
							(indexes[kind]=indexes[kind]||[]).push(key)
							if(index.unique)
								key['$option']={unique:true}
						})
						p.resolve(indexes)
					})
				})
			})
		})

		return p
	}
	saveClientCode(src){
		if(!this.targetApp.uname && this.targetApp!=this.app)
			return Promise.reject("can't upload because of no unique name")
		var fs = require('fs'), target;

		if(this.targetApp==this.app)
			target=`${AppMan.config.appRoot}`
		else {
			target=`${AppMan.config.appRoot}/${this.targetApp.uname}`
		}

		return new Promise((resolve, reject)=>{
			fs.readFile(src,"utf8",(e, data)=>{
				if(e)
					reject(e.message)
				else{
					require('mkdirp')(target, (e)=>{
						if(e)
							reject(e.message)
						else {
							fs.writeFile(`${target}/allin1.html`, data, "utf8",
								(e)=>{
									e ? reject(e.message) : resolve(this.targetApp.apiKey)
								})
						}
					})
				}
			})
		})
	}
}

Object.assign(AppMan, {
	checkApp(app){
		module.exports.checkApp(app)
	},
	parseQuery(id, query){
		var r=Entity.parseQuery(id,query)
		r[1].fields.password=false
		return r
	},
	routes:{
		"get /schemas": function(req, res){
			(new this(req, res))
				.getSchema()
				.then((schema)=>this.send(res, {results:schema}),this.error(res))
		},
		"get /schemas/indexes": function(req, res){
			(new this(req, res))
				.getIndexes()
				.then((indexes)=>this.send(res, indexes), this.error(res))
		},

		"get /schemas/:collection": Entity.routes["get :id?"],

		"delete /schemas/:id": function(req, res){
			new this(req, res)
				.dropCollection(req.params.id)
				.then((names)=>this.send(res,names),this.error(res))
		},

		"post /schemas":function(req, res){
			(new this(req, res))
				.makeSchema(req.body)
				.then(()=>this.send(res),this.error(res))
		},

		"post /schemas/clientcode": function(req, res){
			new this(req, res)
				.saveClientCode(req.files.clientcode.path)
				.then((info)=>this.send(res,info),this.error(res))
		}
	}
});
