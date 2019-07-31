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
			let [Type, _id]=parent.split(":")
			let comment=await app.createEntity(`${Type}Comments`, {...data, parent:_id, author:user._id})
			comment.__typename=`${Type}Comment`
			return comment
		},
	},

	Comment: {
		__resolveType({__typename}, context, {variableValues:{id}}){
			if(__typename)
				return __typename
			if(id){
				return id.split(":")[0]
			}
		}
	},
}

exports.build=(Type)=>{
	const CommentType=`${Type}Comment`
	const Pagination=Schema.buildPagination(CommentType)
	
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
				id: Schema.ID,
				author({author},_,{app,user}){
					return app.getDataLoader("User").load(author)
				},
				isOwner({author},_,{app,user}){
					return author===user._id
				},
			},
			Query:{
				[`${type}_comments`]:(_,{parent,last,before},{app,user})=>{
					return app.prevPage(CommentType,{last,before}, cursor=>cursor.filter({parent}))
				},
			},
		})
	}

	return schema
}
