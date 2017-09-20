module.exports=(Type, HostColName)=>{
	HostColName=HostColName || (Type[0].toLowerCase()+Type.substr(1)+'s')
	const CommentType=`${Type}_Comment`
	const makeCommentColName=(hostColName)=>hostColName.substr(0,-1)+"Comments"
	const CommentColName=makeCommentColName(HostColName)

	return {
		typeDefs:`
			type ${CommentType}{
				id: ID!
				content: String!
				author: Named!
				createdAt:  Date!
				host: ${Type}!
			}

			extend type ${Type}{
				comments:[${CommentType}]
			}

			extend type Mutation{
				comment(host:ID!,content:String!): ${CommentType}
			}
		`,

		resolver:{
			[CommentType]:{
				author(_,{},{app,user}){
					return user
				},
				host({parent},{},{app}){
					return app.get1Entity(HostColName, {_id:parent})
				}
			},

			[Type]:{
				async comments({_id}, {}, {app,user}){
					let conn=await app.collection(CommentColName)
					try{
						return await conn.find({parent:_id}).toArray()
					}finally{
						conn.close()
					}
				}
			},

			Mutation:{
				async comment(_,{host, content},{app,user}){
					let [type,parent]=host.split(":")
					return await app.createEntity(makeCommentColName(type), {content, parent, author:user._id})
				}
			}
		}
	}
}
