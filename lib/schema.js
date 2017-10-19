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
	
	interface Named{
		id: ID!
		name: String
		photo(size: Int=25): String
	}

	type User implements Node, Named{
		id: ID!
		photo(size: Int=25): String
		name: String
		email: String
		phone: String
		createdAt: Date!
		updatedAt: Date
		token: String
	}

    type Query{
		version: String!
		node(id:ID!):Node
		schema: String!
    }

	type Mutation{
		requestToken(contact:String!): Boolean
		login(contact:String!, token: String!, name: String): User
		logout:Boolean
	}
	
	type Subscription{
		ping:Boolean
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
		description:"mongodb ID",
		parseValue(value) {
			let [name,id]=value.split(":")
			return id||name
		}
	},
	
	JSON: require("graphql-type-json"),

	Node: {
		__resolveType(obj, context, {variableValues:{id}}){
			let [colName]=id.split(":")
			return colName[0].toUpperCase()+colName.substring(1,colName.length-1)
		}
	},

	Query: {
		version:()=>"2.0.1",
		async node(_,{id}, {app}){
			let [col, _id]=id.split(":")
			return await app.get1Entity(col, {_id})
		},
		schema(_,{},{app}){
			return require("graphql/utilities")
				.printSchema(app.schema)
		}
	},
	User:{
		name(user){
			return user.name||user.username
		},
		token(user,args,{app}){
			return app.encode(user)
		},

		id(user){
			return `users:${user._id}`
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
			resolve(){
				
			},
			subscribe(){
				
			}
		}
	}
}

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
		},
		
		[`${Type}Connection`]:{
			pageInfo({edges,hasNextPage,hasPreviousPage}){
				let first=edges[0],last=edges[edges.length-1]
				const cursor=a=>a ? `${a.createdAt.getTime()}:${a._id}` : undefined
				return {
					hasNextPage,hasPreviousPage,
					endCursor: cursor(last),
					startCursor: cursor(first)
				}
			}
		}
	}
})
