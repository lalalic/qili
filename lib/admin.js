exports.typeDefs=`
    type Application{
        _id: ObjectID!
        apiKey: String!
        name: String!
        author: User
        createdAt: Date!
        updatedAt: Date
    }

	extend type User{
		applications: [Application]!
	}

	extend type Mutation{
		app_create(name: String!): Application
		app_update(id: ObjectID!, name:String): Application
        app_remove(id: ObjectID!): Boolean
	}
`

exports.resolver={
    Application: {
        author({author},{},{app,user}){
            if(author==user._d)
                return user
        },
        apiKey:({_id})=>_id
    },
    User: {
        async applications({_id},{},{app}){
            let conn=await app.collection("apps")
            try{
                return await conn.find({author:_id})
            }finally{
                conn.close()
            }
        }
    },
    Mutation: {
        app_create(_,args, {app,user:{_id:author}}){
            return app.createEntity("apps", {...args, author})
        },
        app_update(_,{name,_id},{app,user:{_id:author}}){
			return app.patchEntity("apps",{_id,author}, {name,author,updatedAt})
		},
	 	app_remove(_,{_id},{app,user:{_id:author}}){
			return app.remove1Entity("apps", {_id,author})
		},
    }
}
