require("dotenv").config({override:true})
const express = require('express')
const bodyParser = require("body-parser")
const graphql=require('express-graphql')

const {graphql_auth}=require('./user')

const cors=require("cors")

const config=require("../conf")
const server=express()

const httpServer=server.listen(config.server.port, '0.0.0.0')

require("./admin").initData()

server.get(`/test`,(req,res)=>{
	res.send("ok")
})

const app = express.Router()
server.use(`/${config.version}`,app)

server.use("/", typeof(config.www)=="function" ? config.www : express.static(config.www||"www"))

app.use((req, res, next)=>{
	// 设置所有HTTP请求的超时时间
	req.setTimeout(config.server.timeout);
	// 设置所有HTTP请求的服务器响应超时时间
	res.setTimeout(config.server.timeout);
	next();
},
cors({
	methods:'GET,POST',
	maxAge: 24*60*60
}))
	
app.use('/graphql',
	require("./app").resolveApp,
	bodyParser.json({limit:'5mb'}),
	require("./app").resolveQuery,
	graphql_auth({graphiql:false}),
	
/**
 * for effective, app and user should be resolved before parsing body
 * but app resolver is using parse body, which SHOUlD be avoid to enhance
 */
		
	//require("./cli").inspect,

	require("./admin").resolve,

	graphql(({app,user})=>require("./app").graphql(app,user))
)

const resolveAppKey=(req, res, next)=>{
	req.headers['x-application-id']=req.params.appKey
	next()
}

app.use('/:appKey/static', 
	resolveAppKey,
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
	resolveAppKey,
	require('./app').resolveApp,

	require("wechat")(config.wechat.token, (req, res)=>{
		if(req.app && req.app.cloud && req.app.cloud.wechat){
			req.app.cloud.wechat.reply(req,res)
		}else{
			res.status(401).end()
		}
	})
)

app.use('/:appKey/proxy', 
	resolveAppKey,
	require('./app').resolveApp,
	
	function(req, res, next){
		req.originalUrl=req.baseUrl=req.url
		const [,ctx]=req.url.split("/")
		if(req.app.cloud.proxy[ctx]){
			req.app.cloud.proxy[ctx](req, res, next)
		}else{
			req.app.logger.warn(`no proxy for ${ctx}`)
			res.status(404).end()
		}
	}
)

require("./subscription").extend({server:httpServer,config, path:`/${config.version}/graphql`})

module.exports=server