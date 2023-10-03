const {makeExecutableSchema}=require('graphql-tools')
const jwt = require("jsonwebtoken")
const merge = require("lodash.merge")
const NodeCache=require("node-cache")
const assert=require("assert")
const fs = require('fs')
const { createProxyMiddleware } = require('http-proxy-middleware');
const fetch=require("node-fetch2")

const Schema=require("./modules/schema")
const User=require("./user")
const File=require("./modules/file")
const Admin=require("./admin")
const AccessToken=require("./modules/access-token")

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
	add(one){
		this[one.app.apiKey]=one
	},
	remove(_id, reason){
		if(this[_id]){
			const {app:{apiKey,name}}=this[_id]
			this[_id].finalize(reason)
			this[_id].logger.info(`App[${name}] is cleared from cache`)
			delete this[_id]
			Application
				.getDataLoader("App")
				.clear(apiKey)
		}
	}
}

function finalize(reason){
	Object.values(APPS).filter(a=>'finalize' in a).forEach(a=>a.finalize(reason))
}

process.on('exit', ()=>finalize())
process.on('SIGINT',()=>process.exit(0))
process.on('SIGTERM',()=>process.exit(0))

const Passwordlesses=new NodeCache()

exports.resolveApp=(req, res, next)=>{
	const apiKey=req.headers['x-application-id']||req.query?.['x-application-id']
	if(!apiKey || !(apiKey in config.cloud)){
		res.status(401).end()
		return 
	}
	Application.create(apiKey)
		.then(app=>{
			req.app=app
			if(app.localStorage){
				app.localStorage(req, res, next)
			}else{
				next()
			}
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
	const {app:{app:appEntity}}=req

	const resolve=()=>{
		req.body=req.body||{}
		const queryId=req.body.id||req.body.operationName
		const query=req.app.getPersistedQuery(queryId)
		req.body.query= req.body.query||query||req.query?.query
		if(req.method=="post" &&  !req.body?.query){
			res.status(401).end()
			return 
		}
		if(req.body.query){
			req.app.emit('graphql', Object.freeze(req.body))
		}
		next()
	}	
	if('localStorageHandler' in appEntity){
		appEntity.localStorageHandler(req, res, resolve)
		return 
	}

	resolve()
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
		graphiql: !!app.app.graphiql,
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
		if(APPS[apiKey]){
			return Promise.resolve(APPS[apiKey])
		}

		if(config.cloud[apiKey]){
			const {[apiKey]:{code, root, ...app}, __installDir=`${process.cwd()}/apps`}=config.cloud
			const entityApp={_id:apiKey, name:apiKey, apiKey, createDate:new Date(), ...app}
			return File.getStorage(entityApp)
				.catch(error=>File.createStorage(entityApp))
				.then(domain=>{
					switch(typeof(domain)){
						case "string":
							entityApp.storage=domain
						break
						case "object":
							Object.assign(entityApp,domain)
						break
					}
				})
				.then(async ()=>{
					if(code.match(/^https?\:\/\//)){
						const AdmZip = require('adm-zip')

						const projectDir=`${__installDir}/${apiKey}`
						fs.mkdirSync(projectDir,{recursive:true})
						const res=await fetch(code)
						const zip = new AdmZip(await res.buffer());
						zip.extractAllTo(projectDir, true)

						config.cloud[apiKey].code=projectDir
						return `downloaded code from ${code}`
					}
				})
				.then((message)=>{
					const app=new Application(entityApp)
					if(message){
						app.logger.info(message)
					}
					return app
				})
				.then(app=>{
					if(app.cloud.indexes){
						app.buildIndexes(app.cloud.indexes)
					}
					if(app.app.localStorageHandler)
						app.logger.info(`local storage ${app.app.storage} is ready`)
					return app
				})
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

		this.finalize=this.finalize.bind(this)
		
		this.logger=new Proxy(logger,{
			get(target, fn){
				return message=>target[fn](`${app.name} - ${message}`)
			}
		})

        if(!(this.passwordless=Passwordlesses.get(app.apiKey))){
			Passwordlesses.set(app.apiKey,this.passwordless=DataService.createPasswordStore())
		}

		this.compileCloudCode()
		this.emit('load')
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
				this.logger.error(error)
				reject(new Error(error))
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

				if((this.isDev||(contact&&this.app.reviewer==contact)) 
					&& this.app.reviewerLoginCode){
					return ({user,token:this.app.reviewerLoginCode,uid})
				}

				return this[`send${transport}Token`](contact,uid,token)
					.then(({token,uid})=>({user, token, uid}))
			})
            .then(({user,token,uid})=>new Promise((resolve,reject)=>{
                this.passwordless.storeOrUpdate(token,uid,60*1000,null, e=>{
					if(e){
						this.logger.error(e)
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
								this.emit('login',user)
								resolve(user)
							}else{//create user for this contact
								this.emit('user.create',{contact,username})
								this.createEntity("User",{...makeContact(contact),username})
									.then(resolve, reject)
							}
                        }else{
							e && this.logger.error(e)
                            reject()
                        }
                    })
            }))
	}

	logout(user){
		this.passwordless.invalidateUser(user._id,e=>e)
		this.emit('logout', user)
	}

	encode(data,options){
		return jwt.sign(data,config.secret, options)
	}

	isAdmin(){
		return config.adminKey==this.app._id && config.adminKey==this.app.apiKey
	}

	compileCloudCode(){
		if(APPS[this.app._id]){
			return this.cloud=APPS[this.app._id]
		}

		const safe=fn=>{try{return fn()}catch(e){this.logger.error(e.message)}}

		const {getStorage:_,createStorage:_1,destroyStorage:_2,getBucket:_3, ...FileModule}=File
		const modules=[Schema,User,Role, FileModule,]

		if(this.isAdmin()){
			modules.push(Admin)
		}

		try{
			let reportThreshold=0
			let logVariables=null
			const Cloud=Object.freeze({
				AccessToken,
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
			
			const {cloudCode, staticRoot, localCloudCodePath, requireRoot}=(code=>{
				let {code:localCloudCodePath,root:staticRoot, requireRoot}=config.cloud[this.app.apiKey]||{}
				
				if(localCloudCodePath){
					if(fs.statSync(localCloudCodePath).isDirectory()){
						requireRoot=localCloudCodePath
						const pkg=require(`${localCloudCodePath}/package.json`)
						this.app.version=pkg.version
						const cmd=!fs.statSync(`${localCloudCodePath}/yarn.lock`) ? "npm" : "yarn"
						const args=cmd=="yarn" ? ["install", "--production=true"] : ["install", "--production"]
						const {error}=require("child_process")
							.spawnSync(
								cmd, 
								args, 
								{cwd:localCloudCodePath, stdio:'ignore'}
							)
						error && this.logger.error(error);
						
						localCloudCodePath=require("path").resolve(localCloudCodePath, pkg.main||"./index.js")
					}

					try{
						code=fs.readFileSync(localCloudCodePath)

						this.finalize.watcher=fs.watch(localCloudCodePath,(current, prev)=>{
							APPS.remove(this.app._id, "cloud code changed")
						})
						this.logger.info(`cloud code is from ${localCloudCodePath}, watched`)
						
					}catch(e){
						this.logger.error(e)
					}
				}

				if(staticRoot){
					this.logger.info(`static content is served from ${staticRoot}`)
				}

				return {cloudCode:code, staticRoot, localCloudCodePath, requireRoot}
			})(this.app.cloudCode);

			const context=require("vm").createContext({
				Cloud,
				console:this.logger,
				fetch,
				__DEV__:process.env.__DEV__==="true",
				process:{
					version:process.version,
					platform:process.platform,
					arch: process.arch,
					env:{NODE_ENV:"PRODUCTION"},
					nextTick:process.nextTick,
					cwd:()=>""
				},
				setTimeout, setInterval, clearTimeout, clearInterval,
			},{
				name:this.app.name||this.app.apiKey,
			})
				
			context.require=require('./vm-require')({
				root:requireRoot, 
				context, 
				blacklist:config.cloud.__unsupportedModules||[],
				excludes:config.cloud.__requireExcludes||[],
			})
			
			this.emit("compileCloudCode",{modules, cloudCode, staticRoot})

			require("vm").runInContext(cloudCode||"",context,{
				filename:localCloudCodePath,
				displayErrors:true,
				timeout:config.debug ? 10*60*1000 : 5*1000,
			})
			
			const resolver=merge({},...modules.map(a=>{
				if(typeof(a.resolver)=='function'){
					return safe(()=>a.resolver(this.app))
				}
				return a.resolver
			}).filter(a=>!!a).reverse())
			const cloud=Object.create({
				wechat:modules.reduce((service,a)=>{
						if(typeof(a.wechat)=="function")
							safe(()=>a.wechat(service))
						return service
					},Wechat.create()),
				static:modules.reduce((service,a)=>{
						if(typeof(a.static)=="function")
							safe(()=>a.static(service))
						return service
					},require("./expo-updates").call(this, Static.create(staticRoot), modules)),
				schema: makeExecutableSchema({
					typeDefs:modules.map(a=>a.typeDefs).filter(a=>!!a),
					resolvers:resolver,
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
				resolver,
			})

			if(cloud.proxy){
				(()=>{//resolve http proxy
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
				})();
			}

			;(()=>{//resolvePubsub
				const onConnectFns=[], onDisconnectFns=[]
				modules.forEach(async (module)=>{
					if(module.pubsub){
						const {pubsub:{init, onConnect, onDisconnect}}=module
						const pubsub=init?.()
						if(!!pubsub){
							cloud.pubsub=pubsub
						}
						onConnect && onConnectFns.push(onConnect)
						onDisconnect && onDisconnectFns.push(onDisconnect)
					}
				})

				if(cloud.pubsub){
					cloud.pubsub.onConnect=function(){
						onConnectFns.forEach(fn=>safe(()=>fn(...arguments)))
					}
					cloud.pubsub.onDisconnect=function(){
						onDisconnectFns.forEach(fn=>safe(()=>fn(...arguments)))
					}
				}
			})();

			modules.forEach(({events})=>{
				if(events){
					for(let [event, fx] of Object.entries(events)){
						this.on(event, (...args)=>safe(()=>fx(...args)))
					}
				}
			})
			this.logger.info(`events loaded`)

			const finalizes=this.finalize.finalizers=[]
			this.cloud=Object.freeze(cloud)
			Object.freeze(this)

			modules.reduce((finalizes, { init, finalize})=>{
				safe(()=>init?.(this))
				finalizes.push(()=>safe(()=>finalize?.(this)))
				return finalizes
			},finalizes)

			APPS.add(this)
			this.logger.info(`cloud code compiled with ${modules.length} modules: ${modules.map(a=>a.name||"~anonymous").filter(a=>!!a).join(",")}`)
		}catch(e){
			this.emit('compileCloudCode.error',e)
			this.logger.error(`compile error: ${e.message}`)
			
			Application
				.getDataLoader("App")
				.clear(this.app.apiKey)

			throw e
		}
	}

	finalize(reason){
		reason && this.logger.warn(`down because of ${reason}`)
		this.finalize.finalizers?.forEach(f=>f())
		this.finalize.watcher?.close?.()
	}

	
	get isDev(){
		return this.app.isDev!==false
	}

	get canRunInCore(){
		return this.app.canRunInCore===true || this.isAdmin()
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

	get resolver(){
		return this.cloud.resolver
	}

    get schema(){
		return this.cloud.schema
	}

	get printableSchema(){
		return require("graphql/utilities").printSchema(this.schema)
	}

	logRunningMode(){
		if(!this.logRunningMode.done){
			this.logger.info(`${this.app.name} running on ${this.canRunInCore ? 'core' : 'cli'} mode`)
			this.logRunningMode.done=true
		}
	}

	getPersistedQuery(id){
		const {persistedQuery}=this.cloud
		return persistedQuery ? persistedQuery[id] : null
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
		throw new Error('deprecated, use app.resolver.Query/Mutation/...')
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

	async upload({uri, key, ...variables}){
		const {token, key:mayRevisedKey}=await this.resolver.File.file_upload_token({},{...variables, key},{app:this,user:{}})
		
		let stream=await new Promise((resolve,reject)=>{
			require("https").get(uri,stream=>resolve(stream))
		})

		if(stream.headers.location){
			stream=await new Promise((resolve,reject)=>{
				require("https").get(stream.headers.location,stream=>resolve(stream))
			})
		}

		if(this.localStorageHandler){
			const url= this.localStorageHandler.pipe({stream, key, app:this})
			return Promise.resolve(url)
		}

		return new Promise((resolve, reject)=>{
			require("qiniu").io.putReadable(token, mayRevisedKey, stream, null, (error, result, rs)=>{
				if(error){
					reject(error)
				}else{
					resolve(result.data.file_create.url)
				}
			})
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
