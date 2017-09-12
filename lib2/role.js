exports.resolver={
	Mutation:{
		async role_create(_,{name},{app,user:{_id:author}}){
			let conn=await app.collection("roles")
			try{
				let role={name,author,createdAt:new Date()}
				let {insertedId:_id}=await conn.insertOne(role)
				role._id=_id
				return role
			}finally{
				conn.close()
			}
		},
		async role_update(_,{name,_id},{app,user:{_id:author}}){
			let conn=await app.collection("roles")
			try{
				let updatedAt=new Date()
				await conn.findOneAndUpdate({_id,author},{$set:{name,author,updatedAt}})
				return updatedAt
			}finally{
				conn.close()
			}
		},
		async role_remove(_,{_id},{app,user:{_id:author}}){
			let conn=await app.collection("roles")
			try{
				let {deletedCount}=await conn.deleteOne({_id,author})
				return deletedCount==1
			}finally{
				conn.close()
			}
		},
		async role_user_add(_,{_id,users:pending},{app,user:{_id:author}}){
			let [conn,USER]=await app.collection("roles","users")
			try{
				let updatedAt=new Date()
				let {users}=await conn.findOne({_id,author})
				users.splice(users.length-1, 0, ...pending.filter(a=>!users.includes(a)))
				await conn.findOneAndUpdate({_id},{$set:{users,updatedAt}})
				
				pending.forEach(a=>{
					let {roles}=await USER.findOne({_id:a})
					await USER.findOneAndUpdate({_id:a},{$set:{roles:[...roles,_id]}})
				})
				return updatedAt
			}finally{
				conn.close()
			}
		},
		async role_user_remove(_,{_id,users:removing},{app,user:{_id:author}}){
			let [conn,USER]=await app.collection("roles","users")
			try{
				let updatedAt=new Date()
				let {users=[]}=await conn.findOne({_id,author})
				users=users.filter(a=>!removing.includes(a))
				await conn.findOneAndUpdate({_id},{$set:{users,updatedAt}})
				
				removing.forEach(a=>{
					let {roles}=await USER.findOne({_id:a})
					roles.remove(roles.findIndex(_id))
					await USER.findOneAndUpdate({_id:a},{$set:{roles}})
				})
				return updatedAt
			}finally{
				conn.close()
			}
		}
	}
}