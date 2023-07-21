const graphql=require('express-graphql')
const {expressjwt:jwt}=require('express-jwt')
const {makeExecutableSchema}=require('graphql-tools')
const merge = require("lodash.merge")
const Schema=require("./modules/schema")
const File=require("./modules/file")
const config=require("../conf")
const AccessToken=require('./modules/access-token')

const getToken=async req=>{
	let token=req.headers["x-session-token"]||req.query?.['x-session-token']
	if(!token){
		if(token=req.headers["x-access-token"]||req.query?.['x-access-token']){
			token=await AccessToken.get(req.app, token)
		}
	}
	return token
}

exports.name="user"

exports.auth=function(){
	return jwt({
		secret:config.secret,
		requestProperty:"user",
		algorithms:["HS256"],
		getToken
	})
}

exports.web_auth=function(){
	const auth=exports.auth()
	return function(req, res, next){
		req.app.emit('auth.request','web')
		auth(req, res, ()=>{
			let userResolved= Promise.resolve()
			if(req.user){
				const _id=Schema.resolver.ObjectID.parseValue(req.user._id)
				if(_id){
					userResolved=req.app
						.getDataLoader("User")
						.load(_id)
						.then(user=>{
							if(user){
								req.user={...user,sessionToken:getToken(req)}
								req.app.emit('auth', user)
							}
						})
				}else if(req.app.supportAnonymous){
					next()
				}else{
					delete req.user
				}
			}
			userResolved.then(next)
		})
	}
}

exports.graphql_auth=function(options){
	const loginGraphQL=function(req, res){
		req.app.emit('auth.request','graphql')
		if(!req.body?.query){
			res.status(401).end()
			return 
		}
		const {Query, Subscription, ...LoginResolvers}=Schema.resolver
		graphql({...{
			schema:makeExecutableSchema({
				typeDefs: [Schema.typeDefs,File.typeDefs],
				resolvers: LoginResolvers,
			})
		},...options})(req, res)
	}

	const auth=exports.auth()
	return function(req, res, next){
		auth(req, res, ()=>{
			if(req.user){
				const _id=Schema.resolver.ObjectID.parseValue(req.user._id)
				if(_id){
					req.app
						.getDataLoader("User")
						.load(_id)
						.then(user=>{
							if(user){
								req.user={...user,sessionToken:getToken(req)}
								req.app.emit('auth', user)
								next()
							}else{
								throw new Error("no hack")
							}
						})
						.catch(e=>{
							delete req.user
							loginGraphQL(req, res, next)
						})
				}else if(req.app.supportAnonymous){
					next()
				}else{
					delete req.user
					loginGraphQL(req, res, next)
				}
			}else {
				if(!req.app.isLoginRequest(req) && req.app.supportAnonymous){
					req.user={_id:0}
					next()
				}else {
					loginGraphQL(req, res, next)
				}
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
		files(filter:String): [File]
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
		username: ({username,name})=>username||name
	},
	Query: {
		me:(_,a,{app,user})=>{
			return user
		}
	},
	Mutation:{
		user_update(_,$set,{app,user:{_id}}){
			return app.patchEntity("User", {_id}, $set)
		}
	}
}

exports.indexes={
	
}


