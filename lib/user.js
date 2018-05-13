const graphql=require('express-graphql')
const jwt=require('express-jwt')
const {makeExecutableSchema}=require('graphql-tools')
const merge = require("lodash.merge")
const Schema=require("./schema")
const File=require("./file")
const config=require("../conf")

const getToken=req=>req.headers["x-session-token"]||req.query['x-session-token']

exports.auth=function(){
	return jwt({
		secret:config.secret,
		getToken
	})
}

exports.graphql_auth=function(options){

	let middleware=graphql({...{
		schema:makeExecutableSchema({
			typeDefs: [Schema.typeDefs,File.typeDefs],
			resolvers: merge(Schema.resolver,File.resolver)
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
		user_update(photo:URL, username:String,birthday:Date,gender:Gender,location:String,signature:String):Date
	}
`

exports.resolver={
	User: {
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
