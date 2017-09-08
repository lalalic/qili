const {Passwordless} = require('passwordless');
const MongoStore = require('passwordless-memorystore');
const {makeExecutableSchema}=require('graphql-tools')
const {buildSchema} = require('graphql')
const {printSchema} = require("graphql/utilities")

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
	req.app=new Application(req.headers['X-Application-Id']='596c7a5905d49ec80e48085a')
	next()
}

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
	constructor(_id){
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
		
		let passwordless=this.passwordless=new Passwordless()
        passwordless.init(new MongoStore(`mongodb://${config.db.host}:${config.db.port}/${_id}}`))
        passwordless.addDelivery("sms", (tokenToSend, uidToSend, recipient, callback, req)=>{
            console.log(`http://${config.server.host}:${config.server.port}/?by=sms&token=${tokenToSend}&uid=${encodeURIComponent(uidToSend)}`)
            callback()
        })

        passwordless.addDelivery("email",(tokenToSend, uidToSend, recipient, callback, req)=>{
            console.log(`http://${config.server.host}:${config.server.port}/?by=email&token=${tokenToSend}&uid=${encodeURIComponent(uidToSend)}`)
            callback()
            /*
            smtpServer.send({
                text:    'Hello!\nYou can now access your account here: ' 
                    + host + '?token=' + tokenToSend + '&uid=' + encodeURIComponent(uidToSend), 
                from:    yourEmail, 
                to:      recipient,
                subject: 'Token for ' + host
            }, function(err, message) { 
                if(err) {
                    console.log(err);
                }
                callback(err);
            });
            */
        })
	}
	
	getUserID(emailOrPhone){
		return new User(this)
			.get({})
	}
	
	requestToken(emailOrPhone){
		let query=isEmail(email) ? {email:emailOrPhone} : {phone: emailOrPhone}
		this.passwordless.requestToken((emailOrPhone,delivery,callback)=>{
			this.getUserID()
				.then(id=>callback(null, id),e=>callback(e,null))
		},{})({query:{}})
		return true
	}
	
	login(token){
		return "raymond"
	}
	
	encode(user){
		return 
	}
	
	logout(token){
		
		return {_id:"raymond"}
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
}

exports.App=class AppStore extends Entity{
	
}



