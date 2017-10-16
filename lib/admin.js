const {ObjectID}=require("mongodb")
const Comment=require("./comment")
const AppComment=Comment.build("App")
const {Cache,resolve}=require("./app")
const merge = require("lodash.merge")
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
    }

	extend type User{
		apps: [App]!
		app(_id:ObjectID!): App
	}

	extend type Mutation{
		app_create(name: String!, uname:String): App
		app_update(_id: ObjectID!, name:String, uname:String, cloudCode:String): Date
        app_remove(_id: ObjectID!): Boolean
	}

	${Comment.typeDefs}

    ${AppComment.typeDefs}
`

exports.resolver=merge({
    App: {
        author({author},{},{app,user}){
            if(author==user._d)
                return user
        },
        id:({_id})=>`apps:${_id}`
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
					delete Cache[_id]
					return d
				})
		},
	 	app_remove(_,{_id},{app,user:{_id:author}}){
			return app.remove1Entity("apps", {_id,author})
				.then(b=>{
					delete Cache[_id]
					return b
				})
		},
    }
},
Comment.resolver,
AppComment.resolver,
)


exports.resolve=(req, res, next)=>{
    if(req.headers['x-application-id']==config.adminKey
        && req.headers['x-application-id2']
        && config.adminKey!=req.headers['x-application-id2']){
        req.headers['x-application-id']=req.headers['x-application-id2']
        req.user.master=true
        resolve(req, res, next)
    }else{
        next()
    }
}
