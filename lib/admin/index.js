const {ObjectID}=require("mongodb")
const {Cache,resolve,Application}=require("../app")
const Schema=require("../schema")
const config=require("../../conf")
const LogPagination=Schema.buildPagination("Log")
const DataService=require("../data-service")
const {Application:AppService}=require("../app")
const merge = require("lodash.merge")
const File = require("../file")

exports.persistedQuery=require("./persisted-query")

exports.typeDefs=`
	${LogPagination.typeDefs}

    type App implements Node{
        id: ID!
        apiKey: String!
        name: String!
		uname: String
		cloudCode: String
        isDev: Boolean
        author: User
        createdAt: Date!
        updatedAt: Date
		sms_name: String

		schema:  String
		logs(status:String, first:Int, after:JSON): LogConnection
		canRunInCore: Boolean
    }

	extend type User{
		apps: [App]!
		app(_id:ObjectID!): App
	}

	extend type Mutation{
		app_create(name: String!, uname:String): App
		app_update(_id: ObjectID!, name:String, uname:String, cloudCode:String,isDev:Boolean,sms_name:String): App
        app_remove(_id: ObjectID!): Boolean
		app_canRunInCore(_id: ObjectID!, canRunInCore:Boolean): App
	}
`

exports.resolver=merge(LogPagination.resolver,{
    App: {
        id:({_id})=>`apps:${_id}`,
        author({author},{},{app,user}){
            if(author==user._d)
                return user
        },
		schema(parent,{},{app,user}){
			return Schema.resolver.Query.schema(null,{},{app:app._id==parent._id ? app : new Application(parent)})
		},
        isDev:({isDev=true})=>isDev,
		canRunInCore: ({canRunInCore=false,_id},args,{app,user})=>{
			if(app.isAdmin() && _id!=app.app._id && user._id==app.app.author){
				return canRunInCore
			}else{
				return null
			}
		},
		logs(parent,{status,first=10,after}, {app,user}){
			if(parent.author!=user._id)
				return null

			return new DataService(parent)
				.nextPage("logs",{first,after},cursor=>{
					if(status)
						cursor=cursor.filter({status})
					return cursor
				})
		},
		cloudCode:({cloudCode})=>cloudCode||""
    },
    User: {
        async apps(parent,{},{app,user:{_id}}){
            return await app.findEntity("apps",{author:_id})
        },

		async app(_, {_id}, {app,user}){
			return await app.get1Entity("apps",{_id, author:user._id})
		}
    },
    Mutation: {
        app_create(_,args, {app,user:{_id:author}}){
			let creating={...args, apiKey:new ObjectID().toHexString(), author}
			return File.createStorage(creating)
				.then(domains=>{
					creating.storage=domains
					return app.createEntity("apps", creating)
				})
        },
        app_update(_,{_id, ...$set},{app,user:{_id:author}}){
			return ($set.isDev===false ? Promise.resolve() : File.getDomains(app.app).then(storage=>$set.storage=storage,console.error))
				.then(()=>app.patchEntity("apps",{_id,author}, {...$set,author}).then(d=>{
					Cache.remove(_id)
					return app.get1Entity("apps",{_id})
						.then(app=>{
							let service=new AppService(app)
							if(service.cloud.indexes){
								service.buildIndexes(service.cloud.indexes)
							}
							return app
						})
				}))
		},

	 	async app_remove(_,{_id},{app,user:{_id:author}}){
			let cached=Cache[_id]
			if(!cached){
				cached=await app.get1Entity("apps",{_id},{_id:1, name:1, apiKey:1})
			}
			Cache.remove(_id)
			return app.remove1Entity("apps", {_id,author})
				.then(b=>{
					File.destroyStorage(cached)
					return b
				})
		},
		app_canRunInCore(_,{_id,canRunInCore},{app,user:{_id:author}}){
			if(app.isAdmin() && app.app.author==author){
				return app.patchEntity("apps",{_id},{canRunInCore})
					.then(d=>{
						let cached=Cache[_id]
						if(cached){
							cached.canRunInCore=canRunInCore
						}
						return app.get1Entity("apps",{_id})
					})
			}else{
				throw new Error("not allowed")
			}
		}
    }
})


exports.resolve=(req, res, next)=>{
    if(req.headers['x-application-id']==config.adminKey
        && req.headers['x-application-id2']
        && config.adminKey!=req.headers['x-application-id2']){
        req.headers['x-application-id']=req.headers['x-application-id2']
        resolve()(req, res, next)
    }else{
        next()
    }
}

exports.init=({root,rootEmail, rootPhone, adminKey})=>{
	const user={ "_id" : root, email:rootEmail, phone:rootPhone}
	const app={_id:adminKey, apiKey:adminKey, name:adminKey, author:root}

	const ds=new DataService({apiKey:adminKey})

	ds.get1Entity("apps",{apiKey:adminKey})
		.then(exist=>{
			if(!exist){
				let now=new Date()
				app.createdAt=user.createdAt=now
				ds.createEntity("apps",app)
				ds.createEntity("users",user)
			}
		})
}
