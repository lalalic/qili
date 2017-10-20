const {Db, Server, ObjectID}=require("mongodb")
const PasswordlessStore = require('passwordless-nodecache');
const {makeExecutableSchema}=require('graphql-tools')
const {graphql} = require('graphql')
const jwt = require("jsonwebtoken")
const merge = require("lodash.merge")
const DataLoader=require("dataloader")
const NodeCache=require("node-cache")

const Schema=require("./schema")
const User=require("./user")
const Role=require("./role")
const File=require("./file")
const Comment=require("./comment")
const Static =require("./static")
const Wechat=require("./wechat")

const isEmail = require("is-valid-email")
const isPhone = v=>(/^(\+\d{2})?\d{11}$/g).test(v)


const config=require("../conf")

const APPS=exports.Cache={
	remove(_id){
		if(this[_id]){
			let apiKey=this[_id].apiKey
			delete this[_id]       
			Application.admin
				.getDataLoader("apps")
				.clear(apiKey)			
		}  
	}
}

const Passwordlesses=new NodeCache()

exports.resolve=persitedQuery=>(req, res, next)=>{
    Application.create(req.headers['x-application-id'])
        .then(app=>{
            req.app=app
			if(persitedQuery){
				let query=app.getPersistedQuery(req.body.id)
				req.body.query= config.debug||app.isDev||app.isAdmin() ? (query||req.body.query) : query
			}
            next()
        })
        .catch(e=>{
            console.error(e)
            res.status(401).end()
        })
}

function makeContact(contact){
	let o={}
	if(isEmail(contact))
		o.email=contact
	else if(isPhone(contact))
		o.phone=contact
	else
		o._contact=contact
	return o
}

class Application{
    static get mongoServer(){
        return new Server(config.db.host, config.db.port, {'auto_reconnect':true,safe:true})
    }
	
	static get admin(){
		if(!this._admin)
			this._admin=new Application({apiKey:config.adminKey, _id: config.adminKey})
		return this._admin
	}

    static create(id){
        return Application.admin
            .getDataLoader("apps",apiKeys=>Application.admin.findEntity("apps",{apiKey:{$in:apiKeys}}))
			.load(id)
            .then(app=>new Application(app))
    }

    constructor(app){
        require("assert")(app&&app.apiKey)
        this.app=app
		
		this.cloudCode()
		
		this._dataLoaders={}
		if(!(this.passwordless=Passwordlesses.get(app.apiKey))){
			Passwordlesses.set(app.apiKey,this.passwordless=new PasswordlessStore(`mongodb://${config.db.host}:${config.db.port}/${app.apiKey}}`))
		}
	}

    sendEmailToken(email, uid, token){
		const nodemailer = require('nodemailer')
		const {from, ...serverOption}=config.email
		let server=nodemailer.createTransport(serverOption)
		return new Promise((resolve, reject)=>server.sendMail({
			from,
			to:email,
			subject: `code to login`,
			text: token
		}, e=>e ?  reject(e) : resolve({token,uid})))
    }

    sendPhoneToken(phone, uid, token){
		const sms = require("ali-sms");
		const {ACCESS_KEY, SECRET_KEY, sms:{SIGN_NAME,TEMPLATE_CREATE}}=config.ali
		return new Promise((resolve,reject)=>sms({
			accessKeyID:ACCESS_KEY,
			accessKeySecret: SECRET_KEY,
			signName:SIGN_NAME,
			templateCode:TEMPLATE_CREATE,
			paramString:{token},
			recNum:[phone],
		},(error,body)=>{
			if(error){
				reject(error)
			}else{
				body = JSON.parse(body)
				if(body.hasOwnProperty('Model'))
					resolve({token,uid})
				else
					reject(new Error(body.message))
			}
		}))
    }

    requestToken(contact){
		let token=`${Math.floor(Math.random()*900000) + 100000}`
        return this.getUserByContact(contact)
            .then(user=>{
				let uid=user&&user._id||contact
				let transport=isEmail(contact) ? "Email" : (isPhone(contact) ? "Phone" : null)
				if(!transport)
					throw new Error("need either phone or email")
				
				if(config.debug || this.isDev)
					return ({user,token:"1234",uid})
				
				return this[`send${transport}Token`](contact,uid,token)
					.then(()=>({user, token, uid}))
			})
            .then(({user,token,uid})=>new Promise((resolve,reject)=>{
                this.passwordless.storeOrUpdate(token,uid,60*1000,null, e=>{
					if(e)
						reject(e)
					else
						resolve(!!user)
				})
            }))
	}

	login(contact, token, username){
        return this.getUserByContact(contact)
            .then(user=>new Promise((resolve, reject)=>{
                    let uid=user&&user._id||contact
                    this.passwordless.authenticate(token,uid, (e,valid)=>{
                        if(valid){
                            this.passwordless.invalidateUser(uid,e=>e)
							if(user){
								resolve(user)
							}else{//create user for this contact
								this.createEntity("users",{...makeContact(contact),username})
									.then(resolve, reject)
							}
                        }else{
                            reject(e)
                        }
                    })
            }))
	}

	logout({_id:uid}){
		this.passwordless.invalidateUser(uid,e=>e)
	}

	encode({_id}){
		return jwt.sign({_id},config.secret, {expiresIn: "1y"})
	}

	isAdmin(){
		return config.adminKey==this.app._id
	}

	cloudCode(){
		if(APPS[this.app._id]){
			return this.cloud=APPS[this.app._id]
		}
		
		if(this.isAdmin()){
            let {typeDefs, resolver}=require("./admin")
            this.cloud={
				schema:makeExecutableSchema({
					typeDefs:[
						Schema.typeDefs,
						User.typeDefs,
						Role.typeDefs,
						File.typeDefs,
						typeDefs,
					],
					resolvers:merge({},
						Schema.resolver,
						User.resolver,
						Role.resolver,
						File.resolver,
						resolver,
					)
				})
			}
        }else{
			try{
				let hasComment=false
				const Cloud={
					merge,
					static: Static.create(),
					wechat: Wechat.create(),
					buildPagination: Schema.buildPagination,
					buildComment(){
						hasComment=true
						return Comment.build(...arguments)
					},
					file_link(id,urls){
						return Promise.all(urls.map(url=>File.Mutation.file_link(null,{url,id},{app:this})))
					},
					isDev:true,
					typeDefs:"",
					resolver:{},
					persistedQuery:{}
				}
				
				new Function("Cloud", this.app.cloudCode||"")(Cloud);

				Cloud.typeDefs=`
					${Cloud.typeDefs}
					${hasComment ? Comment.typeDefs : ""}
				`
				Cloud.resolver=hasComment ? merge(Cloud.resolver, Comment.resolver) : Cloud.resolver
				
				let {typeDefs,resolver,persistedQuery,isDev,wechat}=Cloud
				
				this.cloud={
					wechat,
					static:Cloud.static,
					schema: makeExecutableSchema({
						typeDefs:[
							Schema.typeDefs,
							User.typeDefs,
							Role.typeDefs,
							File.typeDefs,
							typeDefs,
						],
						resolvers:merge({},
							Schema.resolver,
							User.resolver,
							Role.resolver,
							File.resolver,
							resolver,
						)
					}),
					persistedQuery,
					isDev
				}
			}catch(e){
				console.error(e)
			}
		}
		
		this.cloud.apiKey=this.app.apiKey
		return APPS[this.app._id]=this.cloud
	}
	
	get isDev(){
		return this.cloud.isDev===true
	}
	
	getDataLoader(type, f){
		if(!this._dataLoaders[type]){
			if(!f)
				f=ids=>this.findEntity(type, {_id:{$in:ids}})
			this._dataLoaders[type]=new DataLoader(f)
		}
		return this._dataLoaders[type]
	}
	
	getPersistedQuery(id){
		const {persistedQuery}=this.cloud
		return persistedQuery ? persistedQuery[id] : null
	}

    get schema(){
		return this.cloud.schema
    }
	
	runQL(query,variables,root,context,operationName){
		return graphql(this.schema,query,root,{...context,app:this},variables,operationName)
	}

	async getUserByContact(contact){
		let db=await this.collection("users")
		try{
			let query=makeContact(contact)
			return await db.findOne(query)
		}finally{
			db.close()
		}
	}

	async collection(...names){
		let db=await new Db(this.app.apiKey, this.constructor.mongoServer,{w:1}).open()
		let conns=names.map(name=>db.collection(name))
		conns.forEach(conn=>conn.close=()=>db.close())
		if(names.length==1)
			return conns[0]
		return conn
	}

    async createEntity(cols, doc){
        let conn=await this.collection(cols)
        try{
            doc.createdAt=new Date()
			if(!doc._id)
				doc._id=new ObjectID().toHexString()
            await conn.insertOne(doc)
            return doc
        }finally{
            conn.close()
        }
    }

	async updateEntity(cols,query,doc){
		let conn=await this.collection(cols)
        try{
            (doc.$set=doc.$set||{}).updatedAt=new Date()
            await conn.update(query,doc)
            return doc.$set.updatedAt
        }finally{
            conn.close()
        }
	}

    async patchEntity(cols, query, $set){
        let conn=await this.collection(cols)
        try{
            $set.updatedAt=new Date()
            await conn.findOneAndUpdate(query,{$set})
            return $set.updatedAt
        }finally{
            conn.close()
        }
    }

    async remove1Entity(cols, query){
        let conn=await this.collection(cols)
        try{
            let {deletedCount}=await conn.deleteOne(query)
            return deletedCount==1
        }finally{
            conn.close()
        }
    }

    async get1Entity(cols, query){
        let conn=await this.collection(cols)
        try{
            return await conn.findOne({query})
        }finally{
            conn.close()
        }
    }

    async findEntity(cols, query, filter=cursor=>cursor){
        let conn=await this.collection(cols)
        try{
            return await filter(conn.find(query)).toArray()
        }finally{
            conn.close()
        }
    }
}
