const PasswordlessStore = require('passwordless-nodecache');
const {makeExecutableSchema}=require('graphql-tools')
const jwt = require("jsonwebtoken")
const merge = require("lodash.merge")
const NodeCache=require("node-cache")
const assert=require("assert")

const Schema=require("./schema")
const User=require("./user")
const File=require("./file")
const Admin=require("./admin")

const Role=require("./modules/role")
const Comment=require("./modules/comment")
const Favorite=require("./modules/favorite")
const Statistics=require("./modules/statistics")

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
				.getDataLoader("App")
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
				let query=app.getPersistedQuery(req.body.id||req.body.operationName)
				req.body.query= config.debug||app.isDev||app.isAdmin() ? (req.body.query||query) : query
			}
            next()
        })
        .catch(e=>{
            res.status(401).end()
        })
}

exports.graphql=function(app,user){
	function log(data){
		if(data){
			return app.createEntity("Log",{...data,author:user._id})
		}else
			return Promise.resolve()
	}
	const startedAt=new Date()
	const extractLog=({ document, variables, operationName, result })=>{
		if(!document)
			return null

		let {definitions:[{operation:type,name}]}=document
		if(!operationName){
			if(name)
				operationName=name.value
		}
		if(!operationName)
			return null

		if(operationName=="IntrospectionQuery")
			return null

		return {
			type,
			operation:operationName,
			variables:app.logVariables(variables,operationName),
			status:!!result.errors ? result.errors.length : 0,
			startedAt,
			time:Date.now()-startedAt.getTime()
		}
	}
	let smart={
		extensions(){
			return log(extractLog(...arguments))
		},
	}
	if(app.isDev){
		const optics=require("./optics")
		const opticsContext=optics.context()
		smart={
			schema:optics.instrumentSchema(app.schema),
			context:{app,user,opticsContext},
			extensions(){
				let report=optics.report(opticsContext, {threshold:app.reportThreshold})
				return log(extractLog(...arguments))
					.then(()=>({report}))
			},
			customFormatErrorFn: ({message,path,stack}) => ({message,path,stack}),
		}
	}
	return {
		schema:app.schema,
		context: {app,user},
		graphiql:false,
		...smart,
	}
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

    static create(apiKey){
		return Application
            .getDataLoader("App",apiKeys=>Application._pureDataService
				.findEntity("App",{apiKey:{$in:apiKeys}})
				.then(data=>apiKeys.map(k=>data.find(a=>a.apiKey==k))))
			.load(apiKey)
            .then(app=>{
				if(app)
					return new Application(app)
				else
					throw new Error(`${apiKey} not exists`)
			})
	}
	
	isLoginRequest(req){
		const keys=["authentication_login_Mutation","authentication_requestToken_Mutation"]
		const query=req.body.query
		return !!keys.find(k=>this.getPersistedQuery(k)===query)
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
			signName:this.app.sms_name||SIGN_NAME,
			templateCode:TEMPLATE_CREATE,
			paramString:{code:token},
			recNum:[phone],
		},(error,body)=>{
			if(error){
				reject(error)
			}else{
				let data = JSON.parse(body)
				if(data.Code==='OK')
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
								this.createEntity("User",{...makeContact(contact),username})
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

		const modules=[
			Schema,
			User,
			Role,
			{typeDefs:File.typeDefs, resolver:File.resolver(this.app)},
			(this.isAdmin() ? Admin : {})
		]

		try{
			let reportThreshold=0
			let logVariables=null
			const Cloud=Object.freeze({
				merge,
				ID:Schema.ID,
				buildComment(){
					if(!modules.includes(Comment)){
						modules.push(Comment)
					}
					return Comment.build(...arguments)
				},
				buildFavorite:Favorite.build,
				buildStatistics:Statistics.build,
				buildPagination: Schema.buildPagination,
				
				statistics:Statistics.statistics,
				
				set reportThreshold(v){
					reportThreshold=v
				},

				set logVariables(v){
					logVariables=v
				},
				
				addModule(module){
					if(module && typeof(module)=="object")
						modules.push(module)
					return Cloud
				}
			})

			require("vm").runInNewContext(
				this.app.cloudCode||"",
				{
					Cloud,
					exports:Cloud,
					module:{exports:Cloud},
					__dirname: "",
					__filename: "",
					console,
					process:{
						env:{NODE_ENV:"PRODUCTION"},
						nextTick:process.nextTick,
					},setTimeout, setInterval, clearTimeout, clearInterval,
					root: {},
					global:{},
					require(a){
						return {
							"react":require("react"),
							"react-dom/server":require("react-dom/server"),
							"react-router":require("react-router"),
						}[a]||{}
					}
				},{
					filename:`<qili>/${this.app.name}/cloud-code.js`,
					displayErrors:true,
					timeout:config.debug ? 10*60*1000 : 5*1000,
				}
			)
			this.cloud=Object.freeze(Object.create({
				wechat:modules.reduce((service,a)=>{
						if(typeof(a.wechat)=="function")
							a.wechat(service)
						return service
					},Wechat.create()),
				static:modules.reduce((service,a)=>{
						if(typeof(a.static)=="function")
							a.static(service)
						return service
					},Static.create()),
				schema: makeExecutableSchema({
					typeDefs:modules.map(a=>a.typeDefs).filter(a=>!!a),
					resolvers:merge({},...modules.map(a=>a.resolver).filter(a=>!!a).reverse())
				}),
				persistedQuery:merge({},...modules.map(a=>a.persistedQuery).filter(a=>!!a).reverse()),
				indexes: merge({},...modules.map(a=>a.indexes).filter(a=>!!a).reverse()),
				reportThreshold,
				logVariables,
				apiKey:this.app.apiKey
			}))

			return APPS[this.app._id]=this.cloud
		}catch(e){
			Application
				.getDataLoader("App")
				.clear(this.app.apiKey)

			this.cloud=Object.freeze(Object.create({
				schema: makeExecutableSchema({
					typeDefs:[...modules.map(a=>a.typeDefs).filter(a=>!!a),`#error:${e.message}\nscalar AAError`],
					resolvers:merge({},...modules.map(a=>a.resolver).filter(a=>!!a).reverse())
				}),
				persistedQuery:merge({},...modules.map(a=>a.persistedQuery).filter(a=>!!a).reverse()),
			}))
			console.error(e)
		}
	}

	get isDev(){
		return this.app.isDev!==false
	}

	get canRunInCore(){
		return this.app.canRunInCore===true
	}

	get reportThreshold(){
		return this.cloud.reportThreshold||undefined
	}

	get supportAnonymous(){
		return !!this.schema.getType("Anonymous")
	}

	getPersistedQuery(id){
		const {persistedQuery}=this.cloud
		return persistedQuery ? persistedQuery[id] : null
	}

    get schema(){
		return this.cloud.schema
	}
	
	logVariables(variables,operationName){
		if(!variables)
			return variables
		try{
			if(typeof(this.cloud.logVariables)=="function"){
				variables=this.cloud.logVariables({...variables},operationName)
				if(!variables)
					return variables
			}
			
			Object.keys(variables).forEach(k=>{
				if(typeof(variables[k])=="string" && variables[k].length>32)
					variables[k]=`${variables[k].substring(0,32)}...`
			})
			return variables
		}catch(e){

		}
	}

	runQL(query,variables,root,ctx={user:{}},operationName){
		if(this.cloud.persistedQuery && query in this.cloud.persistedQuery){
			query=this.getPersistedQuery(query)
		}
		
		const {parse} = require('graphql/language')
		const {execute}=require('graphql/execution')

		let document=null
		let {schema,context,extensions,
			formatError=require("graphql").formatError}=exports.graphql(this,ctx.user)

		return Promise.resolve(function(){
			try{
				document=parse(query)
				return execute(schema,document,root,{...ctx,...context},variables)
			}catch(e){
				return {errors:[e]}
		}}())
			.then(result=>{
				if(result && extensions){
					let ext=extensions({
						document,
						variables,
						operationName,
						result
					})

					if(ext)
						result.extensions=ext
				}
				return result
			})
			.catch(e=>({errors:[e]}))
			.then(result=>{
				if (result && result.errors)
					result.errors = result.errors.map(formatError)
				return result
			})
	}

	async getUserByContact(contact){
		let db=await this.collection("User")
		try{
			let query=makeContact(contact)
			return await db.findOne(query)
		}finally{
			db.close()
		}
	}
}

exports.Application=Application
