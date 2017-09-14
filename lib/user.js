const graphql=require('express-graphql')
const jwt=require('express-jwt')
const {makeExecutableSchema}=require('graphql-tools')
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
			typeDefs:require("./schema").typeDefs,
			resolvers: require("./schema").resolver
		})
	},...options})
	
	let auth=exports.auth()
	
	return function(req, res, next){
		auth(req, res, ()=>{
			if(req.user){
				next()
			}else{
				middleware(req, res, next)
			}
		})
	}
}

exports.typeDefs=`
	extend type User{
		roles: [Role]
    }
	
	extend type Query{
		me: User!
	}
	
	extend type Mutation{
		user_update(name:String):Date
	}
`

exports.resolver={
	User: {
		photo({photo},{size},{app}){
			return photo	
		},
		
		async roles({roles=[]},args,{app}){
			let conn=await app.collection("roles")
			try{
				return Promise.all(roles.map(_id=>conn.findOne({_id})))
			}finally{
				conn.close()	
			}
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
		async user_update(_,$set,{app,user:{_id}}){
			let conn=app.collection("users")
			try{
				await conn.updateOne({_id},{$set})
			}finally{
				conn.close()
			}
		}
	}
}