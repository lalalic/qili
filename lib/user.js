"use strict"
var Entity=require("./entity");

class User extends Entity{
	get kind(){return "users"}

	encrypt(text){
		var hasher=require("crypto").createHash("MD5")
		hasher.update(text+Entity.config.secret)
		return hasher.digest("hex")
	}
	beforeCreate(doc){
		if (!doc.username || !doc.password)
				throw new Error("user/password can't be empty.");
		doc.password=this.encrypt(doc.password);
		return super.beforeCreate(doc)
	}
	login(name, password){
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

	}
	getUserInfo(){
		return this.get(this.user,{limit:1})
	}
}


Object.assign(module.exports=User,{
	url:"/users",
	afterPost(doc){
		delete doc.password
		return Object.assign(doc,{
			sessionToken:this.createSessionToken(doc)
		})
	},
	routes:{
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
	resolvSessionToken(token){
		try{
			return Promise.resolve(JSON.parse(new Buffer(token,'base64').toString("utf8")))
		}catch(e){
			console.dir(e)
			return Promise.reject(token)
		}
	},
	resolve(onlyMiddleware){
		//no need user
		!onlyMiddleware && this._makeRoute({
				"post": Entity.routes['post'],
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

		return (req, res, next)=>{
			var token=req.header("X-Session-Token")||req.query['X-Session-Token']
			this.resolvSessionToken(token)
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