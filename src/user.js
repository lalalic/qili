var Entity=require("./entity"),
	_=require("underscore");

export default class Main extends Entity{
	get kind(){
		return "users"
	}

	encrypt(text){
		var hasher=require("crypto").createHash("MD5")
		hasher.update(text)
		return hasher.digest("base64")
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

	_reset(){
		if(this.db.databaseName=='admin')
			this.noSupport()

		return super._reset()
	}

	static get url(){
		return "/users"
	}

	static afterPost(doc){
		delete doc.password
		doc.sessionToken=this.createSessionToken(doc)
		return doc
	}

	static get routes(){
		return {
			"get reset4Test": Entity.routes['get reset4Test'],
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
			"get me": function(req, res){
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
			"post /requestPasswordReset": function(req, res){
				this.error(res)("Not support yet")
			},
			"all /functions/:func":function(req, res){
				var service=new this(req,res);
				service._req.params=req.body||{}
				var cloud=service.getCloudCode();
				cloud.run(req.params.func, service._req, service._res)
			}
		}
	}

	static resolvSessionToken(token){
		return {_id:token||"test", username:token||"test"}
	}

	static createSessionToken(user){
		return user.username
	}
}
