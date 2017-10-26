const {ObjectID}=require("mongodb")
const {Cache,resolve,Application}=require("./app")
const Schema=require("./schema")
const config=require("../conf")


exports.typeDefs=`
    type App implements Node{
        id: ID!
        apiKey: String!
        name: String!
		uname: String
		cloudCode: String
        author: User
        createdAt: Date!
        updatedAt: Date
		
		schema:  String
    }

	extend type User{
		apps: [App]!
		app(_id:ObjectID!): App
	}

	extend type Mutation{
		app_create(name: String!, uname:String): App
		app_update(_id: ObjectID!, name:String, uname:String, cloudCode:String): App
        app_remove(_id: ObjectID!): Boolean
	}
`

exports.resolver={
    App: {
        id:({_id})=>`apps:${_id}`,
        author({author},{},{app,user}){
            if(author==user._d)
                return user
        },
		schema(parent,{},{app,user}){
			return Schema.resolver.Query.schema(null,{},{app:app._id==parent._id ? app : new Application(parent)})
		},
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
            return app.createEntity("apps", {...args, apiKey:new ObjectID().toHexString(), author})
        },
        app_update(_,{_id, cloudCode,...$set},{app,user:{_id:author}}){
			return app.patchEntity("apps",{_id,author}, {...$set,cloudCode,author})
				.then(d=>{
					Cache.remove(_id)
					return app.get1Entity("apps",{_id})
				})
		},
	 	app_remove(_,{_id},{app,user:{_id:author}}){
			return app.remove1Entity("apps", {_id,author})
				.then(b=>{
					Cache.remove(_id)
					return b
				})
		},
    }
}


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

exports.persistedQuery={
    "app_create_Mutation": "mutation app_create_Mutation(\n  $name: String!\n  $uname: String\n) {\n  app_create(name: $name, uname: $uname) {\n    id\n    name\n    uname\n    apiKey\n  }\n}\n",
    "app_remove_Mutation": "mutation app_remove_Mutation(\n  $id: ObjectID!\n) {\n  app_remove(_id: $id)\n}\n",
    "app_update_Mutation": "mutation app_update_Mutation(\n  $id: ObjectID!\n  $name: String\n  $uname: String\n) {\n  app_update(_id: $id, name: $name, uname: $uname) {\n    updatedAt\n    id\n  }\n}\n",
    "cloud_update_Mutation": "mutation cloud_update_Mutation(\n  $id: ObjectID!\n  $cloudCode: String!\n) {\n  app_update(_id: $id, cloudCode: $cloudCode) {\n    ...cloud_app\n    id\n  }\n}\n\nfragment cloud_app on App {\n  cloudCode\n  ...schema_app\n}\n\nfragment schema_app on App {\n  schema\n}\n",
    "main_app_update_Query": "query main_app_update_Query(\n  $id: ObjectID!\n) {\n  me {\n    app(_id: $id) {\n      ...app\n      id\n    }\n    id\n  }\n}\n\nfragment app on App {\n  id\n  name\n  uname\n  apiKey\n}\n",
    "main_cloud_Query": "query main_cloud_Query(\n  $id: ObjectID!\n) {\n  me {\n    app(_id: $id) {\n      ...cloud_app\n      id\n    }\n    id\n  }\n}\n\nfragment cloud_app on App {\n  cloudCode\n  ...schema_app\n}\n\nfragment schema_app on App {\n  schema\n}\n",
    "main_comment_Query": "query main_comment_Query(\n  $parent: ObjectID!\n  $count: Int = 10\n  $cursor: JSON\n) {\n  ...main_appComments\n}\n\nfragment main_appComments on Query {\n  comments: app_comments(parent: $parent, last: $count, before: $cursor) {\n    edges {\n      node {\n        id\n        content\n        type\n        createdAt\n        author {\n          id\n          name\n          photo\n        }\n        isOwner\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasPreviousPage\n      startCursor\n    }\n  }\n}\n",
    "main_my_apps_Query": "query main_my_apps_Query {\n  me {\n    ...my\n    id\n  }\n}\n\nfragment my on User {\n  id\n  username\n  photo\n  apps {\n    id\n    name\n  }\n}\n",
    "main_prefetch_Query": "query main_prefetch_Query {\n  me {\n    name\n    token\n    apps {\n      id\n      name\n      apiKey\n    }\n    id\n  }\n}\n",
}
