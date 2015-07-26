var Entity=require("./entity"),
	_=require('underscore'),
	promise=require("node-promise");

export default class Main extends Entity{
	constructor(req, res){
		super(req,res);
		if(arguments.length && this.app._id!="admin")
			throw new Error("no hack");

		if(arguments.length && !this.user)
			throw new Error("no hack")
	}

	get kind(){
		return "apps"
	}

	isAbleTo(doc, caps){
		if(doc.author._id!==this.user._id)
			throw new Error("Only owner can update application")
	}

	beforeCreate(doc,collection){
		if(!doc.name)
			return this.asPromise(new Error("application name can't be empty"))

		doc.author=_.pick(this.user,"_id","username")

		return this.asPromise(doc)
	}

	afterCreate(doc, collection){
		return this.asPromise()
	}

	beforeUpdate(doc,collection){
		return this.checkACL(doc,collection,['update'])
			.then(function(old){
				var attr=doc, changes=attr['$set']||attr,temp;
				if((temp=changes.cloudCode)){
					try{
						new Function("Cloud",temp)
					}catch(error){
						return this.asPromise(error)
					}
				}

				changes.author=_.pick(this.user,"_id","username")
				return this.asPromise()
			}.bind(this))

	}

	afterUpdate(doc, collection){
		return this.asPromise()
	}

	beforeRemove(doc, collection){
		return this.checkACL(doc,collection,['remove'])
	}

	afterRemove(doc, collection){
		return this.asPromise()
	}

	drop(name){
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

	get(query, options){
		if(this.user && _.isObject(query) && !query._id){
			query['author._id']=this.user._id
		}
		return super.get(query,options)
			.then(function(doc){
				if(this.user && !_.isArray(doc) && doc && doc.author._id!=this.user._id)
					return this.asPromise(new Error("no hack"))
				return doc;
			}.bind(this))
	}

	_getCollectionSchema(name, db){
		var p=new promise.Promise();
		db.collection(name,function(error, collection){
			if(error) return p.reject(error)
			collection.findOne({},function(error, doc){
				if(error) return p.reject(error)
				p.resolve(doc && Object.keys(doc) || [])
			})
		})
		return p
	}

	getSchema(){
		var p=this.dbPromise(), me=this;
		this.db.open(function(error, db){
			if(error) return p.reject(error);
			db.collectionNames(function(error, collections){
				if(error) return p.reject(error);
				var now=new Date()
				promise.all(_.filter(_.map(collections,function(info){
					if((info.name=info.name.split(".")[1])=='system')
						return false
					return me._getCollectionSchema(info.name, db)
						.then(function(schema){
							info.fields=schema
							info.createdAt=now
							return info
						})
				}), function(a){return a}))
				.then(function(schema){
					p.resolve(schema)
				}, function(error){
					p.reject(error)
				})
			})
		})
		return p
	}

	makeSchema(indexes){
		_.each(indexes,function(items, kind){
			delete indexes[kind]
			var index=indexes[kind]={}
			_.each(items, function(item){
				var name=""
				for(var i in item)
					i!="$option" && (name+=("_"+i+"_"+item[i]))
				index[(item['$option']&&item['$option'].name)||name.substr(1)]=item
			})
		})


		var p=this.dbPromise(),
			_error=function(error){
				p.reject(error)
			};
		this.db.open(function(error, db){
			if(error) return _error(error)
			db.collection("system.indexes",function(error, collection){
				collection.find({name:{$ne:"_id_"}}, function(error, info){
					info.toArray(function(error, items){
						promise.allOrNone(_.compact(_.map(items, function(index){
							var kind=index.ns.split('.')[1],
								key=index.key,
								p0=new promise.Promise();
							if(!indexes[kind] || !indexes[kind][index.name]){
								db.dropIndex(kind, index.name, function(error){
									if(error)
										p0.reject(error)
									else
										p0.resolve()
								});
								return p0
							}else
								delete indexes[kind][index.name]
							return
						}))).then(function(){
							var tasks=[]
							_.each(indexes, function(items, kind){
								_.each(items, function(key,name){
									var option=key['$option'];
									if(option)
										delete key['$option']
									var p1=new promise.Promise()
									tasks.push(p1)
									db.createIndex(kind, key, option||{}, function(error,indexName){
										if(error || indexName==null)
											p1.reject(error)
										else
											p1.resolve(kind+"."+name)
									})
								})
							})

							promise.allOrNone(tasks).then(function(m){
								p.resolve(m)
							}, _error)
						}, _error)
					})
				})
			})
		})

		return p
	}

	importData(data){
		var p = this.dbPromise(),
			_error=function(error){	p.reject(error)};
		this.db.open(function (error, db) {
			if(error)
				return p.reject(error)
			promise.allOrNone(_.map(data, function(docs, kind){
				var p0 = new promise.Promise();
				db.collection(kind,function (error, collection) {
					if(error)
						return p0.reject(error)
					collection.insert(docs, function(error,result){
						if(error)
							return p0.reject(error)
						p0.resolve()
					}.bind(this))
				}.bind(this))//collection
				return p0
			}.bind(this))).then(function(){
				p.resolve()
			},function(error){
				p.reject(error)
			})
		}.bind(this))//db.open
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
						_.each(items, function(index){
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

	_reset(docs){
		var p=this.dbPromise()
		this.db.open(function(error, db){
			if(error) return p.reject(error)
			db.collection(this.kind,function(error, collection){
				if(error) return p.reject(error)
				collection.remove({"author._id":"test"}, {writeCommand:true}, function(error){
					if(error) return p.reject(error)
					collection.remove({"author._id":"_test"}, {writeCommand:true},function(error){
						if(error) return p.reject(error)
						collection.insert(docs, {writeCommand:true}, function(error){
							if(error) return p.reject(error)
							p.resolve({ok:1,n:docs.length})
						})
					})
				})
			})
		}.bind(this))

		return p
	}


	static get url(){
		return "/apps"
	}

	static checkApp(app){
		Entity.checkApp(app)
		if(app.name!='admin')
			this.noSupport();
	}

	static afterPost(doc){
		var r=Entity.afterPost(doc)
		r.apiKey=this.createAppKey(doc)
		return r;
	}

	static afterGet(doc){
		if(_.isArray(doc)){
			_.each(doc, function(d){
				d.apiKey=this.createAppKey(d)
			}.bind(this));
		}else
			doc.apiKey=this.createAppKey(doc)
		return Entity.afterGet(doc);
	}

	static createAppKey(doc){
		return doc.name
	}

	static resolveAppKey(key){
		var service=new this()
		service.db=this.getAdminDB()
		service.checkOwner=function(){return true}
		return service.get({name:key},{limit:1})
	}

	static get routes(){
		return _.extend({},Entity.routes,{
			"get reset4Test": function(req, res){
				var service=new this(req,res),
					path=__dirname+"/../test/data/"+service.kind+".js",
					fs=require('fs'),
					exists=fs.existsSync(path),
					content=exists ? require('fs').readFileSync(path, 'utf8') : null,
					data=content ? (new Function("","return "+content))() : null;

				service.db=this.getAdminDB();

				service._reset(data)
					.then(_.bind(function(result){
						this.send(res, result)
					},this),this.error(res))
			},
			"get /my/:app":function(req, res){
				this.send(res, req.path)
			},
			"get /my/:app/bootstrap":function(req, res){this.send(res, req.path)},
			"get /schemas": function(req, res){
				(new this(req, res))
					.getSchema()
					.then(function(schema){
						this.send(res, {results:schema})
					}.bind(this),this.error(res))
			},
			"delete /schemas/:id": function(req, res){
				new this(req, res)
					.drop(req.params.id)
					.then(function(names){
						this.send(res,names)
					}.bind(this),this.error(res))
			},
			"post /schemas":function(req, res){
				(new this(req, res))
					.makeSchema(req.body)
					.then(function(){
						this.send(res)
					}.bind(this),this.error(res))
			},
			"get /indexes": function(req, res){
				(new this(req, res))
					.getIndexes()
					.then(function(indexes){
						this.send(res, indexes)
					}.bind(this), this.error(res))
			}
		}
	}

	static init(){
		Entity.init()

		var service=new this()
		service.db=this.getAdminDB({w:1});
		service.checkOwner=function(){return true}
		service.makeSchema(JSON.parse(JSON.stringify(require("../data/schema"))))
			.then(function(){
				console.info("indexes are updated")
				return service.importData(JSON.parse(JSON.stringify(require("../data/init"))))
			}).then(function(){
				console.info("initial data is imported")
			},function(error){
				if(error.code!=11000)//11000: duplicate key, already created ever
					console.error("self qili ready error:"+error)
			})
	}
}
