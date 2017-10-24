const express = require('express')
const bodyParser = require("body-parser")
const graphql=require('express-graphql')
const {graphql_auth}=require('./user')
const cors=require("cors")
const optics=require("./optics")

const config=require("../conf")
const app = express.Router()
const server=express()

server.listen(config.server.port, "0.0.0.0")
server.on('connection', function (socket) {
	socket.setTimeout(config.server.timeout * 1000)
	console.log(`server is on ${config.server.port}`)
})

server.use(`/${config.version}`,app)

require("./static").extend(app,config)
require("./wechat").extend(app,config)

app.post('/file',
		(req, res, next)=>{
			req.headers['x-application-id']=req.query['x-application-id']
			req.headers['x-session-token']=req.query['x-session-token']
			next()
		},
		require("./app").resolve(),
		require("./user").auth(),
		bodyParser.urlencoded({extended : true, verify: require('./file').verify}),
		require("./file").qiniu
	)

app.use('/graphql',
		cors(),

		bodyParser.json(),

		require("./app").resolve(true),

		graphql_auth({graphiql:true}),

		require("./admin").resolve,

		graphql(({app,user})=>{
			const log=log=>app.createEntity("logs",{...log,author:user._id})
			const startedAt=new Date()
			const extractLog=({ document:{definitions:[{operation:type,name}]}, variables, operationName, result })=>{
				return {
					type,
					operation:name ? name.value : undefined,
					variables:variables && Object.keys(variables).length ? variables : undefined,
					status:!!result.errors ? result.errors.length : 0,
					startedAt,
					time:Date.now()-startedAt.getTime()
				}
			}
			let smart={
				extensions(){
					log(extractLog(...arguments))
					return null
				},
			}
			if(app.isDev){
				const opticsContext=optics.context()
				smart={
					schema:optics.instrumentSchema(app.schema),
					context:{app,user,opticsContext},
					extensions(){
						let report=optics.report(opticsContext)
						log({...extractLog(...arguments), report})
						return report
					},
					formatError: error => ({
					  message: error.message,
					  locations: error.locations,
					  stack: error.stack,
					  path: error.path
					}),
				}
			}
			return {
				schema:app.schema,
				context: {app,user},
				graphiql:app.isAdmin(),
				...smart,
			}
		})
	)
