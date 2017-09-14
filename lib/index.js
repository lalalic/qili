const express = require('express')
const bodyParser = require("body-parser")
const graphql=require('express-graphql')
const {graphql_auth}=require('./user')
const cors=require("cors")

const config=require("../conf")
config.server.port=8080
const app = express.Router()
const server=express()

server.listen(config.server.port, "0.0.0.0")
server.on('connection', function (socket) {
	socket.setTimeout(config.server.timeout * 1000);
	console.log(`server is on ${config.server.port}`)
})

server.use(`/${config.version}`,app)

app.post('/qiniu', 
		bodyParser.json(),
		require("./app").resolve,
		require("./user").auth(),
		bodyParser.urlencoded({extended : true, verify: require('./file').verify}),
		require("./file").qiniu
	)

app.use('/graphql', cors(),
	require("./app").resolve,
	
	graphql_auth({graphiql:true}),
	
	graphql(({app,user})=>{
		return {
			schema:app.schema,
			context: {app,user},
			graphiql:true
		}
	})
)
