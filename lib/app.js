const PasswordlessStore = require('passwordless-nodecache');
const {makeExecutableSchema}=require('graphql-tools')
const {graphql} = require('graphql')
const jwt = require("jsonwebtoken")
const merge = require("lodash.merge")
const NodeCache=require("node-cache")
const assert=require("assert")

const Schema=require("./schema")
const User=require("./user")
const Role=require("./role")
const File=require("./file")
const Comment=require("./comment")
const Static =require("./static")
const Wechat=require("./wechat")
const DataService=require("./data-service")
const config=require("../conf")

const isEmail = require("is-valid-email")
const isPhone = v=>(/^(\+\d{2})?\d{11}$/g).test(v)

const APPS=exports.Cache={
	remove(_id){
		if(this[_id]){
			let apiKey=this[_id].apiKey
			delete this[_id]
			Application
				.getDataLoader("apps")
				.clear(apiKey)
		}
	}
}

const Passwordlesses=new NodeCache()

exports.resolve=persitedQuery=>(req, res, next)=>{
    Application.create(req.headers['x-application-id']||req.query['x-application-id'])
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


class Application extends DataService{
	static getDataLoader(){
		if(!this._pureDataService)
			this._pureDataService=new DataService({apiKey:config.adminKey})
		return this._pureDataService.getDataLoader(...arguments)
	}

    static create(id){
        return Application
            .getDataLoader("apps",apiKeys=>Application._pureDataService
				.findEntity("apps",{apiKey:{$in:apiKeys}})
				.then(data=>apiKeys.map(k=>data.find(a=>a.apiKey==k))))
			.load(id)
            .then(app=>{
				if(app)
					return new Application(app)
				else
					throw new Error(`${id} not exists`)
			})
    }

    constructor(app){
		super(app)
		assert(app._id,"Application must be constructed with full information from Database")

        if(!(this.passwordless=Passwordlesses.get(app.apiKey))){
			Passwordlesses.set(app.apiKey,this.passwordless=new PasswordlessStore(`mongodb://${config.db.host}:${config.db.port}/${app.apiKey}}`))
		}

		this.cloudCode()

		assert(this.cloud, "Application construstion must have error, please check")
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
			paramString:{code:token},
			recNum:[phone],
		},(error,body)=>{
			if(error){
				reject(error)
			}else{
				let data = JSON.parse(body)
				if(data.hasOwnProperty('Model'))
					resolve({token,uid})
				else
					reject(new Error(body))
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
					.then(({token,uid})=>({user, token, uid}))
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
		return config.adminKey==this.app._id && config.adminKey==this.app.apiKey
	}

	cloudCode(){
		if(APPS[this.app._id]){
			return this.cloud=APPS[this.app._id]
		}
		const Admin=require("./admin")
		const typeDefs=[
			Schema.typeDefs,
			User.typeDefs,
			Role.typeDefs,
			File.typeDefs,
			this.isAdmin() ? Admin.typeDefs : ""
		]
		const resolvers=[
			Schema.resolver,
			User.resolver,
			Role.resolver,
			File.resolver,
			this.isAdmin() ? Admin.resolver : {}
		]
		const persistedQuery=[
			Schema.persistedQuery,
			this.isAdmin() ? Admin.persistedQuery : {}
		]

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
				isDev:false,
				typeDefs:"",
				resolver:{},
				persistedQuery:{}
			}
			
			const module={exports:{}}

			require("vm").runInNewContext(
				`${this.app.isDev!==false ? "debugger;" : ""}${this.app.cloudCode||""}`,
				{
					Cloud,
					exports:module.exports,
					module,
					__dirname: "",
					__filename: "",
					root: {},
					global:{},
					require(){
						return {}
					}
				},{
					filename:`<qili>/cloud-code.js`,
					displayErrors:true,
					timeout:config.debug ? 10*60*1000 : 5*1000,
				}
			)

			Cloud.typeDefs=`
				${Cloud.typeDefs}
				${hasComment ? Comment.typeDefs : ""}
			`
			Cloud.resolver=hasComment ? merge(Cloud.resolver, Comment.resolver) : Cloud.resolver

			this.cloud={
				wechat:Cloud.wechat,
				static:Cloud.static,
				schema: makeExecutableSchema({
					typeDefs:[...typeDefs, Cloud.typeDefs],
					resolvers:merge({},Cloud.resolver,...resolvers)
				}),
				persistedQuery:merge({},Cloud.persistedQuery,...persistedQuery,),
				isDev:Cloud.isDev,
				indexes: Cloud.indexes
			}
			
			if(this.cloud.indexes)
				this.buildIndexes(this.cloud.indexes)

			this.cloud.apiKey=this.app.apiKey
			return APPS[this.app._id]=this.cloud
		}catch(e){
			Application
				.getDataLoader("apps")
				.clear(this.app.apiKey)

			this.cloud={
				schema: makeExecutableSchema({
					typeDefs:[...typeDefs,`#error:${e.message}\nscalar AAError`],
					resolvers:merge({},...resolvers)
				}),
				persistedQuery:merge({},...persistedQuery)
			}

			console.error(e)
		}
	}

	get isDev(){
		return this.app.isDev!==false || !!this.cloud.isDev
	}
	
	get performanceThreshold(){
		return this.cloud.isDev ?  this.cloud.isDev.performanceThreshold : undefined
	}

	getPersistedQuery(id){
		assert(this.cloud, "no app.cloud")
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
}

exports.Application=Application
