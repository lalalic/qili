require("dotenv").config({override:true})
const express = require('express')
const bodyParser = require("body-parser")
const graphql=require('express-graphql')

const {graphql_auth}=require('./user')

const cors=require("cors")
const cookieParser=require('cookie-parser')

const config=require("../conf")
const logger=require("./logger")


require("./admin").initData()

const server=express()
const app = express.Router()
server.use(`/${config.version}`, app)
app.use(
	(req, res, next)=>{
		req.setTimeout(config.server.timeout);
		res.setTimeout(config.server.timeout);
		next();
	},

	cors({
		methods:'GET,POST',
		maxAge: 24*60*60,
	}),
)
	
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

const passport=config.passport=require('passport')
passport.serializeUser(function(user,done){
	done(null,user)
})

passport.deserializeUser(function(obj, done){
	done(null, obj)
})

function session(req, res, next){
	req.session={
		save(callback){
			callback()
		},
		regenerate(callback){
			callback()
		}
	}
	next()
}

app.use('/:appKey/static', 
	cookieParser(),
	resolveAppKey,
	require('./app').resolveApp,
	bodyParser.json({limit:'5mb'}),
	require('./user').web_auth(),
	session,
	passport.initialize(), 
	passport.session(),
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

const httpServer=server.listen(config.server.port, '0.0.0.0')

require("./web-socket").extend(httpServer)

server.httpServer=httpServer

;(()=>{//auto intialize all apps

	function test(){
		const fetch=require("node-fetch2")
		const { cloud: {timeout, __installDir, __unsupportedModules, __requireExcludes, ...apps}, api}=config
		const domain=new URL(api).hostname.split(".").splice(-2).join(".")

		Object.entries(apps).forEach(async ([apiKey, {alias=apiKey}])=>{
			const url=`https://${alias}.${domain}`
			try{
				await fetch(url)
				logger.log(`initialized ${url}`)
			}catch(e){
				logger.error(`initializing ${url} error: ${e.message}, but you might ignore it.`)
			}
		})
	}
	setTimeout(test, 2*1000)
})();
module.exports=server