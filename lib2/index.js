const config=require("../conf")
config.server.port=8080
config.version=2


const express = require('express')
const bodyParser = require("body-parser")

const app = express.Router()
const server=express()
server.listen(config.server.port, "0.0.0.0")
server.on('connection', function (socket) {
	socket.setTimeout(config.server.timeout * 1000);
})

server.use(`/${config.version}`,app)

const Admin=require("./admin-app")

const {makeExecutableSchema}=require('graphql-tools')
const graphql=require('express-graphql')



app.use(Admin.resolve())

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

app.use('/graphql', bodyParser.json(), graphql((req, res)=>{
	let {app, user}=req
	let schema=app.buildSchema()
	return {
		schema,
		context: {app,user},
		graphiql:true
	}
}))
