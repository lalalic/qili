"use strict"

var mongo = require("mongodb"),
	config=require("../conf"),
	Service=require("./service"),
	Internal_API=config.Internal_API;

class Entity extends Service{
	constructor (req, res) {
		super(req, res)
		if(req && req.header && req.params.collection){
			this.kind = req.params.collection
			if(this.app._id==config.adminKey && this.kind=='apps')
				Entity.noSupport()
		}

		if(this.app){
			this.db = new mongo.Db(this.app._id.toString(), this.getMongoServer(),{w:1});
			if(res){
				var createdAt=new Date()
				res.on('finish',()=>{
					this.log({
						url:req.originalUrl || req.url,
						remote:	req.ip||req._remoteAddress||(req.connection&&req.connection.remoteAddress)||undefined,
						method: req.method,
						path: req.originalUrl || req.url,
						httpVersion: req.httpVersionMajor + '.' + req.httpVersionMinor,
						referrer: req.headers['referer'] || req.headers['referrer'],
						userAgent: req.headers['user-agent'],
						contentLength:res.get('content-length'),
						status: res.statusCode
					},9)
					this.finish()
				})
			}
		}
	}
	get(query, options) {
		var p = this.dbPromise();
		this.db.open( (error, db) => {
			if(error) return p.reject(error)
			db.collection(this.kind,  (error, collection) =>{
				if(error) return p.reject(error)
				var op=query._id||(options&&options.limit==1) ? 'findOne' : 'find';
				collection[op](query, options||{},  (error, result)=> {
					if(error) return p.reject(error);
					if(op=='findOne'){
						if(query._id && !result){
							p.reject("Not exists")
						}else
							p.resolve(result)
					}else{
						result.toArray( (error, docs) =>error ? p.reject(error) : p.resolve(docs))
					}
				})
			})
		})
		return p
	}
	dbPromise(a){
		var close=()=>this.db.close(),
			p=Object.assign(new Promise((resolve, reject)=>a={resolve, reject}),a)
		p.then(close,close)
		return p
	}
	finish(){
		super.finish()
		if(this._logs && this._logs.length){
			var p=this.dbPromise(), logs=this._logs;
			this.db.open( (error, db) =>{
				if(error) return p.reject(error)
				db.collection("logs",(error, collection)=>{
					if(error) return p.reject(error);
					collection.insert(logs,(error)=>{
						p.resolve()
						delete this
					})
				})
			})
		}
	}
	beforeCreate(doc,collection){
		return this.cloudCode().beforeCreate(Object.assign({object:doc},this.cloudReq), this.cloudRes)
	}
	afterCreate(doc,collection){
		return this.cloudCode().afterCreate(Object.assign({object:doc},this.cloudReq), this.cloudRes)
	}
	beforeUpdate(doc,collection){
		return this.checkACL(doc,collection,['update'])
			.then(function(old){
				return this.cloudCode().beforeUpdate(Object.assign({object:doc,old:old},this.cloudReq), this.cloudRes)
			}.bind(this))
	}
	afterUpdate(doc,collection){
		return this.cloudCode().afterUpdate(Object.assign({object:doc},this.cloudReq), this.cloudRes)
	}
	beforeRemove(doc,collection){
		return this.checkACL(doc,collection,['remove'])
		.then((doc)=>{
			return this.cloudCode().beforeRemove(Object.assign({object:doc},this.cloudReq), this.cloudRes)
		})
	}
	afterRemove(doc,collection){
		return this.cloudCode().afterRemove(Object.assign({object:doc},this.cloudReq), this.cloudRes)
	}
	create(docs) {
		var p = this.dbPromise(),
			_error=(e)=>p.reject(e);
		docs=Array.isArray(docs) ? docs: [docs];
		this.db.open((error, db) =>{
			if(error) return p.reject(error)
			db.collection(this.kind, (error, collection) => {
				if(error) return p.reject(error)

				Promise.all(docs.map((doc)=>
					new Promise((resolve, reject)=>{
						var _error0=(e)=>reject(e)

						this.beforeCreate(doc,collection).then(()=>{
							!doc._id && (doc._id=this.constructor.asObjectId());

							doc.author={_id:this.user._id,username:this.user.username}
							doc.createdAt=doc.updatedAt=new Date()
							collection.save(doc,(error) => {
								if(error) return reject(error)
								this.afterCreate(doc,collection).then(()=>resolve(doc), _error0)
							})
						}, _error0)
					})
				)).then((docs)=>p.resolve(docs.length==1 ? docs[0] : docs),_error)
			})
		})
		return p
	}
	patch(id, doc){
		return this.update(id, {$set:doc})
	}
	update(id, doc){
		var p = this.dbPromise(),
			_error=(e)=>p.reject(e)

		this.db.open( (error, db) =>{
			if(error) return p.reject(error)
			db.collection(this.kind,  (error, collection)=> {
				if(error) return p.reject(error)
				doc._id=id;
				this.beforeUpdate(doc,collection).then(()=>{
					var changes=doc['$set']||doc
					changes.updatedAt=new Date()
					changes.updater={_id:this.user._id,username:this.user.username}
					delete doc._id;
					collection.findAndModify({_id:id}, null, doc, {new:true},  (error,feedback) =>{
						if(error) return p.reject(error)
						this.afterUpdate(feedback.value, collection)
							.then(()=>p.resolve(changes),_error)
					})
				},_error);
			})
		})
		return p
	}
	remove(id){
		var p = this.dbPromise(),
			_error=function(error){	p.reject(error)};
		var doc={_id:id}
		this.db.open( (error, db) => {
			if(error) return p.reject(error)
			db.collection(this.kind,  (error, collection)=> {
				if(error) return p.reject(error)
				this.beforeRemove(doc,collection).then(()=>{
					collection.findAndRemove(doc, (error,feedback) => {
						if(error) return p.reject(error)
						this.afterRemove(feedback.value,collection)
							.then(()=>p.resolve(feedback.value),_error)
					})
				},_error)
			})
		})
		return p
	}
	cloudCode(){
		if(this._cloud)
			return this._cloud;

		return this._cloud=this.getCloudCode().asKindCallback(this)
	}
	checkACL(doc, collection, caps){
		return new Promise((resolve, reject)=>
			collection.findOne({_id:doc._id},(error, found)=>{
				if(error){
					reject(error);
					return
				}
				try{
					this.isAbleTo(found,caps)
				}catch(error){
					reject(error)
					return
				}
				resolve(found)
			})
		)
	}
	dump(){
		throw new Error("Not support yet")
	}
}

Object.assign(module.exports=Entity, {
		url : "/classes/:collection",
		init(){
			if(this.url!==Entity.url){
				require("./").app["all"](`/classes${this.url}/}`, a=>this.noSupport())
			}
			Service.init.apply(this,arguments)
		},
		checkUrl(req,res){
			if(req.params.collection && Internal_API.indexOf(req.params.collection)!=-1)
				this.noSupport()
		},
		beforePost(doc){
			return doc
		},
		afterPost(doc){
			if(Array.isArray(doc))
				return {affected:doc.length}
			else
				return {createdAt:doc.createdAt, updatedAt:doc.updatedAt, _id:doc._id, author: doc.author}
		},
		afterGet(doc){
			return Array.isArray(doc) ? {results:doc} : doc
		},
		getAdminDB(option){
			return new mongo.Db(this.config.adminKey, this.prototype.getMongoServer.call(),option||{w:0})
		},
		parseQuery(id, query){
			var filter = query.query ? JSON.parse(query.query, function (key, value) {
					var a;
					if (typeof value === 'string') {
						a = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
						if (a) {
							return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
									+a[5], +a[6]));
						}
					}
					return value;
				}) : {};

			id && (filter={'_id' : id })

			var options = {fields:{}};

			var test = ['limit', 'sort', 'fields', 'skip', 'hint', 'explain', 'snapshot', 'timeout'];

			for (var o in query) {
				if (test.indexOf(o) >= 0) {
					try {
						options[o] = JSON.parse(query[o]);
					} catch (e) {
						options[o] = query[o];
					}
				}
			}

			return [filter,options]
		},
		routes : {
			"get :id?" : function (req, res) {
				var service=new this(req, res)
				var query=this.parseQuery(req.params.id,req.query);
				service.get.apply(service, query)
				.then((data)=>this.send(res, this.afterGet(data)),this.error(res))
			},
			/**
			 *support batch mode, but just return the number of changed
			 */
			"post" : function(req, res){
				if(!req.body)
					return this.send();

				new this(req, res)
					.create(this.beforePost(req.body))
					.then(doc=>this.send(res, this.afterPost(doc)),this.error(res))
			},
			"put :id": function(req, res){
				if(!req.body) return this.send();
				delete req.body._id;
				new this(req, res)
					.update(req.params.id, req.body)
					.then((doc)=>this.send(res, {updatedAt:doc.updatedAt}),this.error(res))
			},
			"patch :id": function(req, res){
				if(!req.body) return this.send();
				new this(req, res)
					.patch(req.params.id, req.body)
					.then((doc)=>this.send(res, {updatedAt:doc.updatedAt}),this.error(res))
			},
			"delete :id": function(req, res){
				new this(req, res)
					.remove(req.params.id)
					.then((num)=>this.send(res, true),this.error(res))
			}
		}
	})
