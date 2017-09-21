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
			
			${require("./schema").paginationTypes(CommentType)}

			extend type ${Type}{
				comments(first:Int, after:ObjectID, last:Int, before: ObjectID):${CommentType}Connection
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
				async comments({_id}, {after,first,before,last}, {app,user}){
					let conn=await app.collection(CommentColName)
					try{
						let all=await conn.find({parent:_id}).toArray()
						let edges=all
						if(first>0){
							if(first<edges.length){
								edges=edges.slice(0,first)
							}
						}else
							throw new Error(first)
						
						if(last>0){
							if(last<edges.length){
								edges=edges.slice(-last)
							}
						}else
							throw new Error(last)
						
						let afterEdge=-1
						if(after){
							afterEdge=edges.findIndex(({_id})=>_id==after)
							if(afterEdge){
								edges=edges.slice(afterEdge)
							}
						}
						
						let beforeEdge=-1
						if(before){
							beforeEdge=edges.findIndex(({_id})=>_id==before)
							if(beforeEdge){
								edges=edges.slice(0, beforeEdge)
							}
						}
						
						let hasPreviousPage=(function(){
							if(last>0){
								return edges.length>last
							}
							
							if(after){
								if(afterEdge>-1){
									return true
								}
							}
							
							return false
						})();
						
						let hasNextPage=(function(){
							if(first>0){
								return edges.length>first
							}
							
							if(before){
								if(beforeEdge>-1){
									return true
								}
							}
							return false
						})();
						
						
						return {
							edges:edges.map(a=>({node:a, cursor: a._id})),
							pageInfo:{
								hasNextPage,
								hasPreviousPage,
							}
						}
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
