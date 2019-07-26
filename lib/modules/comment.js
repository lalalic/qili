const merge = require("lodash.merge")
const Schema= require('../schema')

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
		comment_create(parent:ID,content:String!, type: CommentType, _id: ObjectID):Comment
	}
`

exports.resolver={
	Mutation:{
		async comment_create(_,{parent,...data},{app,user}){
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
	const Pagination=Schema.buildPagination(CommentType)
	const CommentColName=`${type}Comments`

	const schema={
		typeDefs:`
			type ${CommentType} implements Comment & Node {
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
					return app.getDataLoader("users").load(author)
				},
				isOwner({author},_,{app,user}){
					return author===user._id
				},
			},
			Query:{
				[`${type}_comments`]:(_,{parent,last,before},{app,user})=>{
					return app.prevPage(CommentColName,{last,before}, cursor=>cursor.filter({parent}))
				},
			},
		})
	}

	return schema
}
