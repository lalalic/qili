const config=require("../conf")
config.server.port=8080

const express = require('express')
const bodyParser = require("body-parser")

const app = express.Router()
const server=express()
server.listen(config.server.port, "0.0.0.0")
server.on('connection', function (socket) {
	socket.setTimeout(config.server.timeout * 1000);
})

server.use(`/${config.version}`,app)


const {makeExecutableSchema}=require('graphql-tools')
const graphql=require('express-graphql')

const {Passwordless} = require('passwordless');
const MongoStore = require('passwordless-memorystore');


const SCHEMA={
	typeDefs:`
		interface Entity{
			_id: String!
		}

		type User implements Entity{
			_id: String!
			username: String!
			createdAt: String!
			families: [Family]
			knowledges: [Knowledge]
		}

		type Family implements Entity{
			_id: String!
			name: String!
		}

		type Knowledge implements Entity{
			_id: String!
			title: String!
		}

		type Finished implements Entity{
			_id: String!
			when: Int!
		}

		type Task implements Entity{
			_id: String!
			when: Int
		}

		type Query{
			user(id: String): User
		}
	`,
	resolvers:{
		Query: {
			user: (_, {_id}, {app,user})=>{
				return user
			}
		}
	}
}
app.use(bodyParser.json());

app.use((req, res, next)=>{
	req.headers['X-Application-Id']='596c7a5905d49ec80e48085a'
	next()
})

app.use((req, res, next)=>{
	//resolve application
	req.app={
		db:{},
		buildSchema:()=>makeExecutableSchema(SCHEMA)
	}
	
	let passwordless=new Passwordless()
	passwordless.init(new MongoStore(`mongodb://${config.db.host}:${config.db.port}/${req.headers['X-Application-Id']}}`))
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
	
	req.app.passwordless=passwordless
	
	next()
})

app.use("/sendToken",(req, res, next)=>{
	//resolve user
	let  app=req.app
	let  {passwordless,db}=app
	passwordless.requestToken((emailOrPhone, delivery, callback, req)=>{
		callback(null, "test")
		/*
		db.user.find({id:emailOrPhone}, (error, user)=>{
			callback(error, user._id)
		})
		*/
	},{allowGet:true, deliverField:"sms"})(req, res, ()=>{
		res.send({})
	})
})

app.use("/logout", (req, res, next)=>{
	let  {app:{passwordless}}=req
	passwordless.logout()(req, res, ()=>{
		res.send({})
	})
})

app.use("/login", (req, res, next)=>{
	let  {app:{passwordless}}=req
	passwordless.acceptToken()(req, res, ()=>{
		res.send({})
	})
})

app.use((req, res, next)=>{
	//resolve user
	req.user={_id:"raymond", username:"raymond"}
	next()
})

app.use('/graphql', graphql((req, res)=>{
	let {app, user}=req
	let schema=app.buildSchema()
	return {
		schema,
		context: {app,user},
		graphiql:true
	}
}))



