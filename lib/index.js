const express = require('express')
const bodyParser = require("body-parser")
const formidable=require("formidable")
const graphql=require('express-graphql')

const {graphql_auth}=require('./user')

const cors=require("cors")
const logger=require("./logger")

const config=require("../conf")
const server=express()

const httpServer=server.listen(config.server.port, '0.0.0.0')

require("./admin").initData()

server.get(`/test`,(req,res)=>{
	res.send("ok")
})

const app = express.Router()
server.use(`/${config.version}`,app)

app.use((req, res, next)=>{
		// 设置所有HTTP请求的超时时间
		req.setTimeout(5000);
		// 设置所有HTTP请求的服务器响应超时时间
		res.setTimeout(5000);
		next();
	},
	cors({
		methods:'GET,POST',
		maxAge: 24*60*60
	}))
	
app.use('/graphql',
	require("./app").resolveApp,

	graphql_auth({graphiql:true}),

	bodyParser.json({limit:'5mb'}),
/**
 * for effective, app and user should be resolved before parsing body
 * but app resolver is using parse body, which SHOUlD be avoid to enhance
 */
	
	require("./cli").inspect,

	require("./admin").resolve,

	require("./app").resolveQuery,
	
	graphql(({app,user})=>require("./app").graphql(app,user))
)

app.use('/:appKey/static', 
	(req, res, next)=>{
		req.headers['x-application-id']=req.params.appKey
		next()
	},
	require('./app').resolveApp,
	require('./user').web_auth(),
	(req,res)=>{
		if(req.app && req.app.cloud && req.app.cloud.static){
			req.app.cloud.static.reply(req,res)
		}else{
			res.status(401).end()
		}
	}
)

app.use('/:appKey/wechat', 
	(req, res, next)=>{
		req.headers['x-application-id']=req.params.appKey
		next()
	},
	require('./app').resolveApp,

	require("wechat")(config.wechat.token, (req, res)=>{
		if(req.app && req.app.cloud && req.app.cloud.wechat){
			req.app.cloud.wechat.reply(req,res)
		}else{
			res.status(401).end()
		}
	})
)

require("./subscription").extend(httpServer,config)

logger.info("service started")