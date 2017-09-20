modules.exports=(Type)=>{
	const HostColName=Type[0].toLowerCase()+Type.substr(1)+'s'
	const CommentType=`${Type}_Comment`
	const CommentColName=Type[0].toLowerCase()+Type.substr(1)+"Comments"
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
					let conn=await app.collection(HostColName)
					try{
						return await conn.find({_id:parent})
					}finally{
						conn.close()
					}
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
					return await app.createEntity(type.substr(0,-1)+"Comments", {content, parent, author:user._id})
				}
			}
		}
	}
}