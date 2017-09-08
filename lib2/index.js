require("./utils/merge")

const express = require('express')
const bodyParser = require("body-parser")
const graphql=require('express-graphql')
const jwt=require('express-jwt')
const {graphql_auth}=require('./user')
const {makeExecutableSchema}=require('graphql-tools')

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

app.use(bodyParser.json())

app.use(require("./app").resolve)

app.use('/graphql', 
	jwt({
		secret:config.secret,
		getToken: req=>req.header("X-Session-Token")||req.headers["X-Session-Token"]||req.query['X-Session-Token']
	}),
	graphql_auth({
		schema:makeExecutableSchema({
			typeDefs:`
				type User{
					_id: ID!
					email: String
					phone: String
					username: String
					token: String
				}
				
				type Query{
					me: User
				}
				
				type Mutation{
					requestToken(emailOrPhone: String!): Boolean
					login(token: String!): User
					logout(token: String!): Boolean
				}
			`,
			resolvers:{
				User:{
					token(user,args,{app}){
						return app.encode(user)
					}
				},
				Query: {
					me(){
						throw new Error("Please login first!")
					}
				}, 
				Mutation: {
					requestToken(root,{emailOrPhone},{app}){
						return app.requestToken(emailOrPhone)
					},
					login(root, {token}, {app}){
						return app.login(token)
					},
					logout(root, {token}, {app}){
						return app.logout(token)
					}
				}
			}
		}),
		graphiql:true
	}),
	graphql(({app,user})=>{
		return {
			schema:app.schema,
			context: {app,user},
			graphiql:true
		}
	})
)