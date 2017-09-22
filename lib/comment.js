module.exports=(Type, HostColName)=>{
	HostColName=HostColName || (Type[0].toLowerCase()+Type.substr(1)+'s')
	const CommentType=`${Type}Comment`
	const makeCommentColName=hostColName=>hostColName.substr(0,hostColName.length-1)+"Comments"
	const CommentColName=makeCommentColName(HostColName)

	return {
		typeDefs:`
			interface Comment{
				id: ID!
				content: String!
				author: Named!
				createdAt:  Date!
				host: ${Type}!
			}
			
			interface Edge{
				node: Node
				cursor: ObjectID
			}
			
			interface Connection{
				edges: [Edge]
				pageInfo: PageInfo
			}
			
			type PageInfo{
				hasNextPage: Boolean
				hasPreviousPage: Boolean
			}
			
			type ${CommentType} implements Comment{
				id: ID!
				content: String!
				author: Named!
				createdAt:  Date!
				host: ${Type}!
			}
			
			type ${CommentType}Edge implements Edge{
				node: ${CommentType}
				cursor: ObjectID
			}

			type ${CommentType}Connection implements Connection{
				edges: [${CommentType}Edge]
				pageInfo: PageInfo
			}

			
			extend type Query{
				comments(id:ID!, first:Int, after:ObjectID, last:Int, before: ObjectID): Connection
			}

			extend type Mutation{
				comment(host:ID!,content:String!): Comment
			}
		`,

		resolver:{
			[CommentType]:{
				async author(_,{},{app,user}){
					return await app.get1Entity("users", {_id:user._id})
				},
				async host({parent},{},{app}){
					return await app.get1Entity(HostColName, {_id:parent})
				}
			},

			Query:{
				async comments(_, {id, after,first,before,last}, {app,user}){
					let [colName,_id]=id.split(":")
					let commentColName=makeCommentColName(colName)
					let conn=await app.collection(commentColName)
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
