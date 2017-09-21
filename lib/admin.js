const Comment=require("./comment")("App")
const merge = require("lodash.merge")

exports.typeDefs=`
    type App implements Node{
        id: ID!
        apiKey: String!
        name: String!
		uname: String
        author: User
        createdAt: Date!
        updatedAt: Date
    }

	extend type User{
		apps: [App]!
	}

	extend type Mutation{
		app_create(name: String!, uname:String): App
		app_update(_id: ObjectID!, name:String, uname:String): Date
        app_remove(_id: ObjectID!): Boolean
	}

    ${Comment.typeDefs}
`

exports.resolver=merge({
    App: {
        author({author},{},{app,user}){
            if(author==user._d)
                return user
        },
        apiKey:({_id})=>_id,
        id:({_id})=>`apps:${_id}`
    },
    User: {
        async apps(parent,{},{app,user:{_id}}){
            return await app.findEntity("apps",{author:_id})
        }
    },
    Mutation: {
        app_create(_,args, {app,user:{_id:author}}){
            return app.createEntity("apps", {...args, author})
        },
        app_update(_,{_id, ...$set},{app,user:{_id:author}}){
			return app.patchEntity("apps",{_id,author}, {...$set,author})
		},
	 	app_remove(_,{_id},{app,user:{_id:author}}){
			return app.remove1Entity("apps", {_id,author})
		},
    }
},
Comment.resolver,
)
