const {makeExecutableSchema}=require('graphql-tools')
const jwt = require("jsonwebtoken")
const merge = require("lodash.merge")
const NodeCache=require("node-cache")
const assert=require("assert")
const { createProxyMiddleware } = require('http-proxy-middleware');
const multer=require("multer")


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
const logger=require("./logger")

const isEmail = require("is-valid-email");
const isPhone = v=>(/^(\+\d{2})?\d{11}$/g).test(v)

const APPS=exports.Cache={
	remove(_id){
		if(this[_id]){
			const {apiKey,name}=this[_id]
			delete this[_id]
			Application
				.getDataLoader("App")
				.clear(apiKey)
			console.info(`App[${name}] is cleared from cache`)
		}
	}
}

const Passwordlesses=new NodeCache()

exports.supportUpload=(req, res, next)=>{
	multer({storage:multer.diskStorage({
		destination(req, file, cb){
			const path=`${req.app.cloud.staticRoot}/${req.body.key}`
			require("fs").mkdirSync((a=>(a.pop(),a.join("/")))(path.split("/")),{recursive:true})
			cb(null, path)
		},
		filename(req, file, cb){
			cb(null, file.originalname)
		}
	})}).single("file")(req, res, function(){
		if(req.header['content-type']?.indexOf('multipart')>-1){
			const {"x:id":host,key,token, file}=req.body
			req.body={
				id:"file_create_Mutation",
				variables:{
					_id:key,
					host, 
					mimeType:file.mimetype,
					size:file.size,
				}
			}
		}
		next()
	})
}

exports.resolveApp=(req, res, next)=>{
	Application.create(req.headers['x-application-id']||req.query['x-application-id'])
		.then(app=>{
			req.app=app
			app.isLocalHost=()=>{
				const [hostname]=req.headers.host.split(':')
				return hostname=="localhost"||hostname=="127.0.0.1"
			}
			app && app.name && logger.debug(`App[${app.name}] requesting`)

			next()
		})
		.catch(e=>{
			logger.error(e)
			if(res)
				res.status(401).end()
			else
				throw e
		})
}


exports.resolveQuery=(req, res, next=a=>a)=>{
	const {app}=req
	const queryId=req.body.id||req.body.operationName
	const query=app.getPersistedQuery(queryId)
	req.body.query= app.isLocalHost()||config.debug||app.isDev||app.isAdmin() ? (req.body.query||query) : query	
	app.logger.debug(req.body.query)
	next()		
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
		if(config.cloud[apiKey]){
			const {code, root, ...app}=config.cloud[apiKey]
			return Promise.resolve(new Application({_id:apiKey, name:apiKey, apiKey, createDate:new Date(), ...app}))
		}

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
		if(!req.body || !req.body.query){
			return false
		}
		const keys=["authentication_login_Mutation","authentication_requestToken_Mutation"]
		const query=req.body.query
		return !!keys.find(k=>this.getPersistedQuery(k)===query)
	}

    constructor(app){
		super(app)
		assert(app._id,"Application must be constructed with full information from Database")

		this.logger=new Proxy(logger,{
			get(target, fn){
				return message=>target[fn](`${app.name} - ${message}`)
			}
		})

        if(!(this.passwordless=Passwordlesses.get(app.apiKey))){
			Passwordlesses.set(app.apiKey,this.passwordless=DataService.createPasswordStore())
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
				this.logger.debug(error)
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
					if(e){
						this.logger.debug(e)
						reject(e)
					}else
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
							this.logger.debug(e)
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
			{name:"file", typeDefs:File.typeDefs, resolver:File.resolver(this.app)},
		]

		if(this.isAdmin()){
			modules.push(Admin)
		}

		try{
			let reportThreshold=0
			let logVariables=null
			const Cloud=Object.freeze({
				logger,
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
			const {cloudCode, staticRoot}=(code=>{
				const {code:localCloudCodePath,root:staticRoot, storage}=config.cloud[this.app.name]||{}
				if(localCloudCodePath){
					try{
						const fs=require("fs")
						code=fs.readFileSync(localCloudCodePath)

						fs.watchFile(localCloudCodePath,(current, prev)=>{
							this.logger.debug(`cloud code changed, will reload it`)
							APPS.remove(this.app._id)
						})
						this.logger.info(`cloud code is from ${localCloudCodePath}, watched`)
						
					}catch(e){
						this.logger.error(e)
					}
				}
				if(staticRoot){
					this.logger.info(`static content is served from ${staticRoot}`)
				}

				if(storage){
					this.app.storage=storage
				}
				return {cloudCode:code, staticRoot}
			})(this.app.cloudCode);
			
			require("vm").runInNewContext(cloudCode||"",
				{
					Cloud,
					exports:Cloud,
					module:{exports:Cloud},
					__dirname,
					__filename:`${this.app.name}-cloud-code.js`,
					logger,
					console:logger,
					process:{
						env:{NODE_ENV:"PRODUCTION"},
						nextTick:process.nextTick,
						cwd:()=>""
					},
					setTimeout, setInterval, clearTimeout, clearInterval,
					fetch:require("node-fetch"),
					root:{},
					global:{},
					require(a){
						return {
							"react":require("react"),
							"react-dom/server":require("react-dom/server"),
							"react-router":require("react-router"),
							"graphql-subscriptions":require("graphql-subscriptions"),
							"stream":require('stream'),
						}[a]||{}
					}
				},{
					filename:`${__dirname}/${this.app.name}-cloud-code.js`,
					contextName:this.app.name,
					displayErrors:true,
					timeout:config.debug ? 10*60*1000 : 5*1000,
				}
			)
			const cloud=Object.create({
				wechat:modules.reduce((service,a)=>{
						if(typeof(a.wechat)=="function")
							a.wechat(service)
						return service
					},Wechat.create()),
				static:modules.reduce((service,a)=>{
						if(typeof(a.static)=="function")
							a.static(service)
						return service
					},Static.create(staticRoot)),
				schema: makeExecutableSchema({
					typeDefs:modules.map(a=>a.typeDefs).filter(a=>!!a),
					resolvers:merge({},...modules.map(a=>a.resolver).filter(a=>!!a).reverse())
				}),
				proxy: modules.reduce((options,a)=>{
					return (options||a.proxy) && ({...options, ...a.proxy})
				},null),
				persistedQuery:merge({},...modules.map(a=>a.persistedQuery).filter(a=>!!a).reverse()),
				indexes: merge({},...modules.map(a=>a.indexes).filter(a=>!!a).reverse()),
				reportThreshold,
				logVariables,
				apiKey:this.app.apiKey,
				name:this.app.name,
				staticRoot,
			})
			modules.reduce((a,module)=>{
				if(module.init){
					module.init(cloud)
					this.logger.info(`module[${module.name}] inited`)
				}
			}, cloud)

			if(cloud.proxy){
				Object.keys(cloud.proxy).forEach(key=>{
					const option=cloud.proxy[key]
					try{
						cloud.proxy[key]=createProxyMiddleware(`/${key}`, option)
						this.logger.info(`${key} proxy created with options ${JSON.stringify(option)}`)
					}catch(e){
						this.logger.error(`proxy[${key}] - ${e.message} - options: ${JSON.stringify(option)}`)
						delete cloud.proxy[key]
					}
				})
			}
			this.logger.info(`cloud code compiled with modules:${modules.map(a=>a.name).filter(a=>!!a).join(",")}`)
			return APPS[this.app._id]=this.cloud=Object.freeze(cloud)
		}catch(e){
			this.logger.error(e)
			
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
			
		}finally{
			const schema=require("graphql/utilities").printSchema(this.schema)
			console.debug(schema)
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

	get pubsub(){
		return this.cloud.pubsub
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
				this.logger.error(e)
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
