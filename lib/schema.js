const {PubSub}=require("graphql-subscriptions")

exports.persistedQuery=require("./persisted-query")

exports.ID=({_id},_,context,{parentType:{name}})=>`${name}:${_id}`,
exports.name="schema"
exports.typeDefs=`
	schema {
		query: Query
		mutation: Mutation
		subscription: Subscription
	}

    scalar Date

	scalar ObjectID

	scalar JSON

	interface Node {
		id: ID!
	}

	type PageInfo{
		hasNextPage: Boolean
		endCursor: JSON

		hasPreviousPage: Boolean
		startCursor: JSON
	}

	type User implements Node{
		id: ID!
		photo(size: Int=25): URL
		name: String
		email: String
		phone: String
		createdAt: Date!
		updatedAt: Date
		token: String
	}

	type Log implements Node{
		id: ID!
		type: String
		operation: String
		variables: JSON
		status: Int
		startedAt: Date
		time: Int
		report: JSON
		author: User
	}

    type Query{
		version: String!
		schema: String!
    }

	type Mutation{
		requestToken(contact:String!): Boolean
		login(contact:String!, token: String!, name: String): User
		logout:Boolean
	}

	type Subscription{
		ping:Int
	}
`

exports.resolver={
	Date:{
		parseValue(value) {
		  return new Date(value); // value from the client
		},
		serialize(value) {
		  return value.toISOString(); // value sent to the client
		},
		parseLiteral(ast) {
		  if (ast.kind === Kind.INT) {
			return parseInt(ast.value, 10); // ast value is always in string format
		  }
		  return null;
		}
	},

	ObjectID: {
		description:"ID like mongodb ObjectID",
		parseValue(value) {
			if(!value)
				return null
			let [name,...id]=value.split(":")
			id=id.join(":")
			return id||name
		}
	},

	JSON: require("graphql-type-json"),
	
	Node: {
		__resolveType(obj, context, {variableValues:{id}}){
			return id.split(":")[0]
		},
	},

	Query: {
		version:()=>"2.0.1",
		schema(_,{},{app}){
			return require("graphql/utilities")
				.printSchema(app.schema)
		}
	},
	User:{
		id:exports.ID,
		name(user){
			return user.name||user.username
		},

		token(user,args,{app}){
			return app.encode(user)
		},
		
		photo({photo},{size},{app}){
			return photo
		}
	},
	Log:{
		id:exports.ID,
		author({author},{},{app,user}){
			return app.getDataLoader("User")
				.get(author)
		}
	},
	Mutation: {
		requestToken(root,{contact},{app}){
			return app.requestToken(contact)
		},
		login(root, {token,contact,name}, {app}){
			return app.login(contact,token,name)
		},
		logout:(_,a,{app,user})=>app.logout(user)
	},
	Subscription:{
		ping:{
			subscribe(_, {}, {app}){
				const pubsub=app.pubsub
				return pubsub.asyncIterator('ping')
			},
			resolve(payload){
				return payload
			}
		}
	}
}
var pinged=0

exports.indexes={
	Log:[
		[{createdAt:-1},{ expireAfterSeconds: 24*60*60*30 }]
	],
	User:[
		{author:1},
		[{phone:1},{unique:true}],
		[{email:1},{unique:true}],
	]
}
const cursor=a=>a ? `${a.createdAt.getTime()}:${a._id}` : undefined
exports.buildPagination=Type=>({
	typeDefs:`
		type ${Type}Edge{
			node: ${Type}
			cursor: JSON
		}

		type ${Type}Connection{
			edges: [${Type}Edge]
			pageInfo: PageInfo
		}
	`,
	resolver:{
		[`${Type}Edge`]:{
			node: node=>node,
			cursor: node=>cursor(node),
		},

		[`${Type}Connection`]:{
			pageInfo({edges,hasNextPage,hasPreviousPage}){
				return {
					hasNextPage,
					hasPreviousPage,
					startCursor: cursor(edges[0]),
					endCursor: cursor(edges[edges.length-1]),
				}
			}
		}
	}
})

exports.pubsub={
	init(){
		return new PubSub()
	}
}