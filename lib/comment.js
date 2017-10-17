const merge = require("lodash.merge")

exports.typeDefs=`
	enum CommentType {
		photo
		text
	}	
	
	interface Comment{
		id: ID!
		content: String!
		type: CommentType
		author: User!
		createdAt:  Date!
		parent: ObjectID!
		isOwner: Boolean
	}
	
	extend type Mutation{
		comment_create(parent:ID,content:String!, type: CommentType):Comment
	}	
`

exports.resolver={	
	Mutation:{
		async comment_create(_,{parent,...data},{app,user}){
			debugger
			let [types, _id]=parent.split(":")
			let type=types.substr(0,types.length-1)
			let comment=await app.createEntity(`${type}Comments`, {...data, parent:_id, author:user._id})
			comment.__typename=`${type[0].toUpperCase()+type.substr(1,type.length-1)}Comment`
			return comment
		},
	},
	
	Comment: {
		__resolveType({__typename}, context, {variableValues:{id}}){
			if(__typename)
				return __typename
			if(id){
				let [colName]=id.split(":")
				return colName[0].toUpperCase()+colName.substring(1,colName.length-1)
			}
		}
	},
}

exports.build=(Type)=>{
	const type=Type[0].toLowerCase()+Type.substr(1)
	const CommentType=`${Type}Comment`
	const Pagination=require("./schema").buildPagination(CommentType)
	const CommentColName=`${type}Comments`
	
	const schema={
		typeDefs:`
			type ${CommentType} implements Comment,Node{
				id: ID!
				content: String!
				type: CommentType
				author: User!
				createdAt:  Date!
				parent: ObjectID!
				isOwner: Boolean
			}
			
			${Pagination.typeDefs}
			
			extend type Query{
				${type}_comments(parent:ObjectID,last:Int, before: JSON):${CommentType}Connection
				
			}
		`,

		resolver:merge(Pagination.resolver,{
			[CommentType]:{
				id: ({_id})=>`${CommentColName}:${_id}`,
				author({author},_,{app,user}){
					if(author==user._id)
						return user
					return app.get1Entity("users",{_id:author})
				},
				isOwner({author},_,{app,user}){
					return author===user._id
				},
			},
			Query:{
				[`${type}_comments`]:(_,{parent,last,before="0"},{app,user})=>{
					let count=parseInt(before)
					return {
						edges:new Array(last).fill(0).map((a,i)=>i+1).reverse().map(i=>({
								_id:`${i+count}`,
								content:`comment ${i+count}`,
								author:user._id,
								createdAt: new Date(),
								parent,
							})
						),
						hasPreviousPage:true,
					}
				},
			},
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
