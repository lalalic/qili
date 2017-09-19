const graphql=require('express-graphql')
const jwt=require('express-jwt')
const {makeExecutableSchema}=require('graphql-tools')
const Schema=require("./schema")
const config=require("../conf")

exports.auth=function(){
	return jwt({
		secret:config.secret,
		getToken: req=>req.header("X-Session-Token")||req.headers["X-Session-Token"]||req.query['X-Session-Token']
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
				req.user._id=Schema.resolver.ObjectID.parseValue(req.user._id)
				next()
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
	
	input user_updateInput{
		username:String
		birthday:Date
		gender:Gender
		location:String
		signature:String
	}
	
	extend type Mutation{
		user_update(data:user_updateInput!):Date!
	}
`

exports.resolver={
	User: {
		photo({photo},{size},{app}){
			return photo
		}
	},
	Query: {
		me:async (_,a,{app,user:{_id}})=>{
			let conn=await app.collection("users")
			try{
				return await conn.findOne({_id})
			}finally{
				conn.close()
			}
		}
	},
	Mutation:{
		user_update(_,{data:$set},{app,user:{_id}}){
			return app.patchEntity("users", {_id}, $set)
		}
	}
}
