const mongo=require("mongodb")
const PasswordlessStore = require('passwordless-memorystore');
const {makeExecutableSchema}=require('graphql-tools')
const {buildSchema} = require('graphql')
const {printSchema} = require("graphql/utilities")
const jwt = require("jsonwebtoken")
const isEmail = require("is-email")

const {User} = require("./user")
const {Entity} = require("./entity")

const config=require("../conf")
const SCHEMA=exports.schema=`
    type Application{
        _id: ID!
        apiKey: String!
        token: String!
        name: String!
        author: User!
        createdAt: Date!
        updatedAt: Date
    }

	type User{
		_apps: [Application]!
	}

	type Mutation{
		createApplication(name:String!): Application
		updateApplication(id: ID!, name:String): Date
	}

	type Query{
		version: String!
	}
`

const RESOLVER=exports.resolver={

}

exports.resolve=(req, res, next)=>{
    Application.create(req.headers['X-Application-Id']='596c7a5905d49ec80e48085a')
        .then(app=>{
            req.app=app
            next()
        })
        .catch(e=>{
            console.error(e)
            res.status(401).end()
        })
}

const APPS={}
class Application{
	static get APP_SCHEMA(){
		try{
			return buildSchema(`
				${require("./types/date").schema}
				${require("./user").schema}
				type Query{
					_version:String!
				}
				`
			)
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
        this.db=new mongo.Db(_id, this.constructor.mongoServer,{w:1})

        this.app={
			_id,
			schema: `
				type Application{
					logs: [Log]!
				}
				type Log{
					_id: String!
				}

				type Query{
					log: Log
				}
			`
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

    requestToken(emailOrPhone){
        return new User(this)
			.getByContact(emailOrPhone)
            .then(user=>this[`send${isEmail(emailOrPhone) ? "Email" : "Phone"}Token`](emailOrPhone, user._id))
            .then(({token,uid})=>new Promise((ok,nok)=>{
                this.passwordless.storeOrUpdate(token,uid,60*1000,null, e=>ok(!!!e))
            }))
	}

	login(emailOrPhone, token){
        return new User(this)
            .getByContact(emailOrPhone)
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
            resolvers:{
				version: "0.0.1",
                ...require("./types/date").resolver,
                ...require("./user").resolver,
                ...require("./app").resolver
            }
        })
    }

	get	typeDefs(){
		try{
			let schema=this.constructor.APP_SCHEMA
			schema=schema
				.merge(buildSchema(SCHEMA))
				.merge(buildSchema(this.app.schema))
			schema=printSchema(schema)
			console.log(schema)
			return schema
		}catch(e){
			console.error(e)
		}
	}

    entity(name){

    }
}
