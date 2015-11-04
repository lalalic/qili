var Super=require("./entity"), _=require("underscore");
module.exports=Super.extend({
	kind:"users",
	encrypt: function(text){
		var hasher=require("crypto").createHash("MD5")
		hasher.update(text+Super.config.secret)
		return hasher.digest("hex")
	},
	beforeCreate: function(doc){
		if (!doc.username || !doc.password)
				throw new Error("user/password can't be empty.");
		doc.password=this.encrypt(doc.password);
		return Super.prototype.beforeCreate.apply(this,arguments)
	},
	login: function(name, password){
		if (!name || !password)
			throw new Error("name or password can't be empty.");

		return this.get({username: name},{limit:1})
			.then(function(doc){
				if(doc==null)
					throw new Error("username or password is not correct.");

				if (this.encrypt(password)==doc.password)
					return doc

				throw new Error("username or password is not correct.");
			}.bind(this))

	},
	getUserInfo: function(){
		return this.get(this.user,{limit:1})
	}
},{
	url:"/users",
	afterPost: function(doc){
		delete doc.password
		return _.extend(doc,{
			sessionToken:this.createSessionToken(doc)
		})
	},
	routes:{
		"get :id?": function(req, res){
			Super.routes['get :id?'].call(this,req, res)
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
	createSessionToken: function(user){
		return new Buffer(JSON.stringify({username:user.username,_id:user._id})).toString('base64')
	},
	resolvSessionToken: function(token){
		try{
			return Promise.resolve(JSON.parse(new Buffer(token,'base64').toString("utf8")))
		}catch(e){
			console.dir(e)
			return Promise.reject(token)
		}
	},
	resolve: function(onlyMiddleware){
		//no need user
		!onlyMiddleware && this._makeRoute({
				"post": Super.routes['post'],
				"get /login": function(req, res){
					new this(req,res)
						.login(req.query.username, req.query.password)
						.then(function(user){
							delete user.password
							user.sessionToken=this.createSessionToken(user)

							this.send(res,user)
						}.bind(this),this.error(res))
				},
				"get /requestPasswordReset": function(req, res){
					this.error(res)("Not support yet")
				},
				"get /requestVerification": function(req, res){
					var phone=req.query.phone
					//call third service to send a number to phone
					//remember it in server side for verification
					this.send(res,{})
				},
				"get /verifyPhone": function(req, res){
					var phone=req.query.phone,
						code=req.query.code
					//check the code
					this.send(res,{})
				}
			});

		return function(req, res, next){
			var token=req.header("X-Session-Token")||req.query['X-Session-Token']
			this.resolvSessionToken(token)
				.catch(()=>{
					if(this.config.debug)
						console.dir({url:req._parsedUrl, body:req.body, headers:req.headers})
					next(new Error("No Session"))
				})
				.then((user)=>{
					req.user=user
					next()
				})
		}.bind(this)
	}
})