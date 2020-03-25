exports.name="role"
exports.typeDefs=`
	type Role implements Node{
		id: ID!
		name: String!
        createdAt: Date!
        updatedAt: Date
		author: User
		users: [User]
    }

	extend type User{
		roles: [Role]
    }

	extend type Mutation{
		role_create(name:String):Role
		role_update(_id:ObjectID!,name:String):Date
		role_remove(_id:ObjectID!):Boolean
		role_user_add(_id:ObjectID!, users: [String!]!): Date
		role_user_remove(_id:ObjectID!, users: [String!]!): Date
	}
`

exports.resolver={
	User: {
		async roles({roles=[]},args,{app}){
			let conn=await app.collection("Role")
			try{
				return await conn.find().toArray()
				//return Promise.all(roles.map(_id=>conn.findOne({_id})))
			}finally{
				conn.close()
			}
		}
	},
	Role: {
		id({_id}){
			return `roles:${_id}`
		},
		async users({users},{},{app}){
			let conn=await app.collection("User")
			try{
				return Promise.all(users.map(_id=>conn.findOne({_id})))
			}finally{
				conn.close()
			}
		}
	},
	Mutation:{
		role_create(_,args,{app,user:{_id:author}}){
			return app.createEntity("Role",{...args, author})
		},
		role_update(_,{_id, ...$set},{app,user:{_id:author}}){
			return app.patchEntity("Role",{_id}, {...$set,author})
		},
	 	role_remove(_,{_id},{app,user:{_id:author}}){
			return app.remove1Entity("Role", {_id,author})
		},

		async role_user_add(_,{_id,users:pending},{app,user:{_id:author}}){
			let [conn,USER]=await app.collection("Role","User")
			try{
				let updatedAt=new Date()
				let {users}=await conn.findOne({_id,author})
				users.splice(users.length-1, 0, ...pending.filter(a=>!users.includes(a)))
				await conn.findOneAndUpdate({_id},{$set:{users,updatedAt}})

				await pending.forEach(a=>
					USER
						.findOne({_id:a})
						.then(({roles})=>
							USER
								.findOneAndUpdate({_id:a},{$set:{roles:[...roles,_id]}})
							)
					)
				return updatedAt
			}finally{
				conn.close()
			}
		},
		async role_user_remove(_,{_id,users:removing},{app,user:{_id:author}}){
			let [conn,USER]=await app.collection("Role","User")
			try{
				let updatedAt=new Date()
				let {users=[]}=await conn.findOne({_id,author})

				users=users.filter(a=>!removing.includes(a))
				await conn.findOneAndUpdate({_id},{$set:{users,updatedAt}})

				await removing.forEach(a=>
					USER
						.findOne({_id:a})
						.then(({roles})=>{
							roles.remove(roles.findIndex(_id))
							return USER.findOneAndUpdate({_id:a},{$set:{roles}})
						})
				)
				return updatedAt
			}finally{
				conn.close()
			}
		}
	}
}

exports.indexes={
	
}
//it seems await can't be used in array.ForEach
