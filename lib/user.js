const graphql=require('express-graphql')
const jwt=require('express-jwt')
const {makeExecutableSchema}=require('graphql-tools')
const Schema=require("./schema")
const config=require("../conf")

const getToken=req=>req.header("X-Session-Token")||req.headers["X-Session-Token"]||req.query['X-Session-Token']

exports.auth=function(){
	return jwt({
		secret:config.secret,
		getToken
	})
}

exports.graphql_auth=function(options){

	let middleware=graphql({...{
		schema:makeExecutableSchema({
			typeDefs: Schema.typeDefs,
			resolvers: Schema.resolver
		})
	},...options})

	let auth=exports.auth()

	return function(req, res, next){
		auth(req, res, ()=>{
			if(req.user){
				let _id=Schema.resolver.ObjectID.parseValue(req.user._id)
				req.app
					.getDataLoader("users")
					.load(_id)
					.then(user=>{
						if(user){
							req.user={...user,sessionToken:getToken(req)}
							next()
						}else{
							throw new Error("no hack")
						}
					})
					.catch(e=>{
						delete req.user
						middleware(req, res, next)
					})
			}else{
				middleware(req, res, next)
			}
		})
	}
}

exports.typeDefs=`
	enum Gender {
		girl
		boy
	}
	extend type User{
		username: String
		birthday: Date
		gender: Gender
		location: String
		signature: String
	}

	extend type Query{
		me: User!
	}

	extend type Mutation{
		user_update(username:String,birthday:Date,gender:Gender,location:String,signature:String):Date
	}
`

exports.resolver={
	User: {
		photo({photo},{size},{app}){
			return photo
		},
		name:({username,name})=>username||name,
		username: ({username,name})=>username||name,
	},
	Query: {
		me:(_,a,{app,user})=>{
			return user
		}
	},
	Mutation:{
		user_update(_,$set,{app,user:{_id}}){
			return app.patchEntity("users", {_id}, $set)
		}
	}
}
