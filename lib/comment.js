const merge = require("lodash.merge")

const makeCommentColName=hostColName=>hostColName.substr(0,hostColName.length-1)+"Comments"

module.exports=(Type, HostColName)=>{
	const Pagination=require("./schema").pagination("Comment")
	HostColName=HostColName || (Type[0].toLowerCase()+Type.substr(1)+'s')
	const CommentType=`${Type}Comment`
	const CommentColName=makeCommentColName(HostColName)
	const schema={
		typeDefs:`
			type Comment implements Node{
				id: ID!
				content: String!
				author: User!
				createdAt:  Date!
				host: ID!
			}

			extend type Mutation{
				comment(host:ID!,content:String!): Comment
			}

			${Pagination.typeDefs}

			extend type ${Type}{
				comments(last:Int, before: String): CommentConnection
			}
		`,

		resolver:merge(Pagination.resolver,{
			Comment:{
				id:({_id})=>`comments:${_id}`,
				async author(_,{},{app,user}){
					return await app.get1Entity("users", {_id:user._id})
				}
			},

			[Type]:{
				async comments({_id},{last,before="0"},context){
					let count=parseInt(before)
					return {
						edges:new Array(last).fill(0).map((a,i)=>i+1).reverse().map(i=>({
								_id:`${i+count}`,
								content:`comment ${i+count}`,
								author:"root",
								createdAt: new Date(),
								host: `apps:qiliAdmin`,
							})
						),
						pageInfo:{
							hasPreviousPage:true,
							startCursor:`${count+last}`
						}
					}
					return comments({},{host:`${HostColName}:${_id}`,...args}, context)
				}
			},

			Mutation:{
				async comment(_,{host, content},{app,user}){
					let [type,parent]=host.split(":")
					return await app.createEntity(makeCommentColName(type), {content, parent, author:user._id})
				}
			}
		})
	}

	return schema
}

async function comments(_, {host, before,last}, {app,user}){
	let [colName,_id]=host.split(":")
	let commentColName=makeCommentColName(colName)
	let conn=await app.collection(commentColName)
	try{
		let all=await conn.find({parent:_id}).toArray()
		let edges=all

		if(last>0){
			if(last<edges.length){
				edges=edges.slice(-last)
			}
		}else
			throw new Error(last)

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

		return {
			edges,
			pageInfo:{
				hasPreviousPage,
				startCursor: edges[0] && edges[0]._id
			}
		}
	}finally{
		conn.close()
	}
}
