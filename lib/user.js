"use strict"
const Entity=require("./entity");
const sms = require("ali-sms");
const {ACCESS_KEY, SECRET_KEY, sms:{SIGN_NAME,TEMPLATE_CREATE,TEMPLATE_RESET}}=Entity.config.ali

function sendSmsCodeTo(phone,template=TEMPLATE_CREATE, callback){
	let code=`${Math.floor(Math.random()*900000) + 100000}`
	if(Entity.config.debug){//for test only
		code="123456"
		if(callback)
			callback(code)
		return Promise.resolve(code)
	}else{
		let send=()=>new Promise((resolve,reject)=>sms({
				accessKeyID:ACCESS_KEY,
				accessKeySecret: SECRET_KEY,
				signName:SIGN_NAME,
				templateCode:template,
				paramString:{code},
				recNum:[phone],
			},(error,body)=>{
				if(error){
					reject(error)
				}else{
					body = JSON.parse(body)
					if(body.hasOwnProperty('Model'))
						resolve(code)
					else
						reject(body.message)
				}
			}));

		if(callback){
			callback(code)
			setTimeout(()=>send().catch(e=>console.error(`sms error: ${e}`)),60*1000)
		}else {
			return send()
		}
	}
}

function encrypt(text){
	var hasher=require("crypto").createHash("MD5")
	hasher.update(text+Entity.config.secret)
	return hasher.digest("hex")
}

function createSalt(code,phone){
	return encrypt(`${code}@${phone}`)
}

class User extends Entity{
	get kind(){return "users"}

	encrypt(){
		return encrypt(...arguments)
	}

	create(username, password, phone){
		var doc={username, password, phone}
		var p = this.dbPromise(),
			_error=(e)=>p.reject(e);
		this.db.open((error, db) =>{
				p.db=db

			if(error)
				return p.reject(error)

			db.collection(this.kind, (error, collection) => {
				if(error)
					return p.reject(error)

				this.beforeCreate(doc,collection).then(()=>{
					doc._id=this.constructor.asObjectId()

					doc.createdAt=doc.updatedAt=new Date()
					collection.save(doc,(error) => {
						if(error)
							return p.reject(error)

						this.afterCreate(doc,collection)
							.then(()=>p.resolve(doc), _error)
					})
				}, _error)
			})
		})
		return p
	}

	checkExists(field,value){
		return this.get({[field]:value},{limit:1})
	}

	beforeCreate(doc){
		if (!doc.username || !doc.password)
				throw new Error("user/password can't be empty.");
		doc.password=this.encrypt(doc.password);
		return super.beforeCreate(doc)
	}

	login(name, password){
		if (!name || !password)
			Promise.reject(new Error("name or password can't be empty."))

		return this.get({username: name},{limit:1})
			.then((doc)=>{
				if(doc==null)
					throw new Error("username or password is not correct.");

				if (this.encrypt(password)==doc.password)
					return doc

				if(doc.reset && (Date.now()-doc.reset.valid<2*60*60*1000) && this.encrypt(password)==doc.reset.password)
					return doc

				throw new Error("username or password is not correct");
			})

	}
	getUserInfo(){
		return this.get(this.user,{limit:1})
	}
}


Object.assign(module.exports=User,{
	url:"/users",
	createSalt,
	afterPost(doc){
		delete doc.password
		delete doc.reset
		return Object.assign(doc,{
			sessionToken:this.createSessionToken(doc)
		})
	},
	routes:{
		"get /xping": function(req, res){
			if(req.application && req.user)
				this.send(res, req.user.username)
			else
				this.error(res)('neither app nor user')
		},
		"post": function(req, res, next){
			if(req.body && req.body._id){
				req.params.id=req.body._id
				delete req.body._id
				delete req.body.id
			}
			this.routes["patch :id"].apply(this,arguments)
		},
		"post /resetPassword": function(req, res, next){
			const {oldPassword,newPassword}=req.body
			let service=new User(req, res)
			const user=service.user
			service
				.login(user.username,oldPassword)
				.then(user=>service.patch(user._id,{password:service.encrypt(newPassword),reset:undefined}))
				.then(user=>this.send(res,{updatedAt:user.updatedAt}),this.error(res))
		},
		"patch :id": function(req, res){
			if(!req.body)
				return this.send();

			let user=req.body
			"updatedAt,createdAt,_id,username,password,author,sessionToken,phone".split(",")
				.forEach(key=>delete user[key])

			new this(req, res)
				.patch(req.params.id, user)
				.then((doc)=>this.send(res, {updatedAt:doc.updatedAt}),this.error(res))
		},
		"get :id?": function(req, res){
			Entity.routes['get :id?'].call(this,req, res)
		},
		"get /me": function(req, res){
			new this(req,res).getUserInfo()
				.then(function(user){
					if(user){
						delete user.password
						user.sessionToken=this.createSessionToken(user)
						this.send(res, user)
					}else
						this.error(res)("Invalid Session")
				}.bind(this),this.error(res))

		},
		"all /functions/:func":function(req, res){
			var service=new this(req,res);
			service.cloudReq.params=req.body||{}
			var cloud=service.getCloudCode();
			cloud.run(req.params.func, service.cloudReq, service.cloudRes)
		}
	},
	createSessionToken(user){
		return new Buffer(JSON.stringify({username:user.username,_id:user._id})).toString('base64')
	},
	resolvSessionToken(req){
		try{
			var token=req.header("X-Session-Token")||req.headers["X-Session-Token"]||req.query['X-Session-Token']
			if(token)
				return Promise.resolve(JSON.parse(new Buffer(token,'base64').toString("utf8")))
			else{
				var auth=req.header('Authorization')
				if(!auth)
					return Promise.reject()
				var info=auth.split(/\s+/)
				if(info[0].toLowerCase()!=='basic' || info.length!=2)
					return Promise.reject()
				info=new Buffer(info[1],'base64').toString("utf8").split(":")
				return new this(req).login(info[0],info[1])
			}
		}catch(e){
			return Promise.reject(token)
		}
	},
	parseQuery(id, options){
		var data=Entity.parseQuery(id, options),
			fields=data[1].fields,
			keys=Object.keys(fields)

		if(keys.length==0)
			fields.password=0
		else if(!fields[keys[0]])
			fields.password=0
		else
			delete fields.password;

		return data
	},
	resolve(onlyMiddleware){
		!onlyMiddleware && this._makeRoute({//no user yet
				"post /signup": function(req, res, next){
					if(!req.body)
						return this.send();

					const {username,password,verifyPhone:{phone,code,salt}}=req.body
					if(salt!==createSalt(code,phone)){
						this.error(res)("code can't be verified")
					}else{
						let service=new this(req, res)
						//here can't use Promise.all to check concurently, otherwise db connection closed error
						service.checkExists("username",username)
							.then(a=>{
								if(a){
									this.error(res)("username or phone has already been registered")
								}else{
									service.checkExists("phone",phone)
										.then(b=>{
											if(b){
												this.error(res)("username or phone has already been registered")
											}else{
												service.create(username, password, phone)
													.then(doc=>this.send(res, this.afterPost(doc)),this.error(res))
											}
										},this.error(res))
								}
							},this.error(res))
					}
				},
				"post /login": function(req, res){
					if(!req.body)
						return this.send();

					const {username,password}=req.body
					new this(req,res)
						.login(username, password)
						.then(user=>this.send(res,this.afterPost(user)),this.error(res))
				},
				"post /requestPasswordReset": function(req, res){
					let {verifyPhone:{phone,code,salt}}=req.body
					if(salt!==createSalt(code,phone)){
						this.send(res,{error:"code can't be verified"})
					}else{
						let service=new User(req,res)
						service.checkExists("phone",phone)
							.then(exist=>{
								if(exist){
									this.send(res,{message:"temp password will be sent about 1 minutes later"})

									service.user=exist
									sendSmsCodeTo(phone,TEMPLATE_RESET,function(code){
										service.patch(service.user._id,{
											reset:{
												valid:Date.now(),
												password:encrypt(code)
											}
										}).catch(error=>console.error(`sms patching error: ${error}`))
									})

								}else{
									this.error(res)("phone is not correct")
								}
							},this.error(res))
					}
				},

				"post /requestPhoneCode": function(req, res){
					let {phone,existence}=req.body

					new User(req,res)
						.checkExists("phone",phone)
						.then(exist=>{
							if(!!exist==existence)
								sendSmsCodeTo(phone,TEMPLATE_CREATE)
									.then(code=>this.send(res,{salt:createSalt(code,phone)}),this.error(res))
							else
								this.error(res)(existence==false ? "phone has been used by another person" : "phone not registered")
						},this.error(res))
				},
				"get /ping": function(req, res){
					this.send(res,"ok")
				}
			});

		return (req, res, next)=>{
			this.resolvSessionToken(req)
				.catch(()=>{
					if(this.config.debug)
						console.dir({url:req._parsedUrl, body:req.body, headers:req.headers})
					next(new Error("No Session"))
				})
				.then((user)=>{
					user._id=this.asObjectId(user._id)
					req.user=user
					next()
				})
		}
	}
})