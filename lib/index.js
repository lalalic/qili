const express = require('express')
const bodyParser = require("body-parser")
const graphql=require('express-graphql')
const {graphql_auth}=require('./user')
const cors=require("cors")

const config=require("../conf")
const app = express.Router()
const server=express()

server.listen(config.server.port, "0.0.0.0")
server.on('connection', function (socket) {
	socket.setTimeout(config.server.timeout * 1000)
	console.log(`server is on ${config.server.port}`)
})

require("./admin").init(config)

server.use(`/${config.version}`,app)

app.use('/graphql',
		cors({
			methods:'GET,POST',
			maxAge: 24*60*60
		}),

		bodyParser.json(),

		require("./app").resolve(true),

		graphql_auth({graphiql:true}),

		require("./cli").inspect,

		require("./admin").resolve,

		graphql(({app,user})=>require("./app").graphql(app,user))
	)

require("./static").extend(app,config)
require("./wechat").extend(app,config)
