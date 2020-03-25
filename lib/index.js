const express = require('express')
const bodyParser = require("body-parser")
const graphql=require('express-graphql')
const {graphql_auth}=require('./user')
const cors=require("cors")
const logger=require("./logger")

const config=require("../conf")
const app = express.Router()
const server=express()

server.listen(config.server.port, "0.0.0.0")
server.setTimeout(5000);

require("./admin").init(config)

server.use(`/${config.version}`,app)

app.use('/graphql',
		cors({
			methods:'GET,POST',
			maxAge: 24*60*60
		}),

		bodyParser.json({limit:'5mb'}),

		require("./app").resolve(true),

		graphql_auth({graphiql:true}),

		require("./cli").inspect,

		require("./admin").resolve,

		graphql(({app,user})=>require("./app").graphql(app,user))
	)

require("./static").extend(app,config)
require("./wechat").extend(app,config)