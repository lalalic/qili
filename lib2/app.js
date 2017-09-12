const mongo=require("mongodb")
const PasswordlessStore = require('passwordless-memorystore');
const {makeExecutableSchema}=require('graphql-tools')
const {buildSchema} = require('graphql')
const {printSchema} = require("graphql/utilities")
const jwt = require("jsonwebtoken")
const isEmail = require("is-email")
const merge = require("lodash.merge")

const config=require("../conf")

const APPS={}

exports.resolve=(req, res, next)=>{
    Application.create(req.headers['X-Application-Id']=config.adminKey)
        .then(app=>{
            req.app=app
            next()
        })
        .catch(e=>{
            console.error(e)
            res.status(401).end()
        })
}


class Application{
	static get APP_SCHEMA(){
		try{
			return buildSchema(require("./schema").schema)
		}catch(e){
			console.error(e)
		}
	}

    static get mongoServer(){
        return new mongo.Server(config.db.host, config.db.port, {'auto_reconnect':true,safe:true})
    }

    static create(id){
        if(APPS[id])
            return Promise.resolve(APPS[id])

        return Promise.resolve(APPS[id]=new Application(id))
    }

    constructor(_id){
        this.app={
			_id
		}

		this.passwordless=new PasswordlessStore(`mongodb://${config.db.host}:${config.db.port}/${_id}}`)
	}

    sendEmailToken(email, uid){
        let token="safasdxxx"
        return Promise.resolve({token,uid})
    }

    sendPhoneToken(phone, uid){
        let token="safasdxxx"
        return Promise.resolve({token,uid})
    }

    requestToken(contact){
        return this.getUserByContact(contact)
            .then(user=>this[`send${isEmail(contact) ? "Email" : "Phone"}Token`](contact, user._id))
            .then(({token,uid})=>new Promise((ok,nok)=>{
                this.passwordless.storeOrUpdate(token,uid,60*1000,null, e=>ok(!!!e))
            }))
	}

	login(contact, token){
        return this.getUserByContact(contact)
            .then(user=>new Promise((resolve, reject)=>{
                    let uid=user._id
                    this.passwordless.authenticate(token,uid, (e,valid)=>{
                        if(valid){
                            this.passwordless.invalidateUser(uid,e=>e)
                            resolve(user)
                        }else{
                            reject(e)
                        }
                    })
            }))
	}
	
	logout({_id:uid}){
		this.passwordless.invalidateUser(uid,e=>e)
	}

	encode({_id,username}){
		return jwt.sign({_id,username},config.secret, {expiresIn: "1y"})
	}

	isAdmin(){
		return config.adminKey==this.app._id
	}

    get schema(){
        return makeExecutableSchema({
            typeDefs:[
                this.typeDefs
            ],
            resolvers:merge(
				require("./schema").resolver,
                require("./user").resolver,
				this.app.cloud
            )
        })
    }

	get	typeDefs(){
		try{
			let schema=this.constructor.APP_SCHEMA
			if(this.app.schema)
				schema=schema.merge(buildSchema(this.app.schema))
			schema=printSchema(schema)
			console.log(schema)
			return schema
		}catch(e){
			console.error(e)
		}
	}
	
	async getUserByContact(contact){
		let db=await this.collection("users")
		try{
			let bEmail=isEmail(contact)
			let query=bEmail ? {email:contact} : {phone: contact}
			
			return await db.findOne(query)
		}finally{
			db.close()
		}
	}
	
	async collection(...names){
		let db=await new mongo.Db(this.app._id, this.constructor.mongoServer,{w:1}).open()
		let conns=names.map(name=>db.collection(name))
		conns.forEach(conn=>conn.close=()=>db.close())
		if(names.length==1)
			return conns[0]
		return conn
	}
}
