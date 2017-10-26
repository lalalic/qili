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
		photo(size: Int=25): String
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
			let [name,...id]=value.split(":")
			id=id.join(":")
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
	Log:{
		id:({_id})=>`logs:${_id}`,
		author({author},{},{app,user}){
			return app.getDataLoader("users")
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

exports.persistedQuery={
    "userProfile_update_Mutation": "mutation userProfile_update_Mutation(\n  $photo: String\n  $username: String\n  $birthday: Date\n  $gender: Gender\n  $location: String\n  $signature: String\n) {\n  user_update(photo: $photo, username: $username, birthday: $birthday, gender: $gender, location: $location, signature: $signature)\n}\n",
    "account_update_Mutation": "mutation account_update_Mutation(\n  $photo: String\n) {\n  user_update(photo: $photo)\n}\n",
    "authentication_login_Mutation": "mutation authentication_login_Mutation(\n  $contact: String!\n  $token: String!\n  $name: String\n) {\n  login(contact: $contact, token: $token, name: $name) {\n    id\n    token\n  }\n}\n",
    "authentication_requestToken_Mutation": "mutation authentication_requestToken_Mutation(\n  $contact: String!\n) {\n  requestToken(contact: $contact)\n}\n",
    "comment_create_Mutation": "mutation comment_create_Mutation(\n  $parent: ID!\n  $content: String!\n  $type: CommentType\n) {\n  comment: comment_create(parent: $parent, content: $content, type: $type) {\n    __typename\n    id\n    content\n    type\n    createdAt\n    author {\n      id\n      name\n      photo\n    }\n    isOwner\n  }\n}\n",
    "file_create_Mutation": "mutation file_create_Mutation(\n  $_id: String!\n  $host: ID!\n  $bucket: String\n  $size: Int\n  $crc: Int\n  $mimeType: String\n  $imageInfo: JSON\n) {\n  file_create(_id: $_id, host: $host, bucket: $bucket, size: $size, crc: $crc, mimeType: $mimeType, imageInfo: $imageInfo) {\n    url\n    id\n  }\n}\n",
    "file_token_Mutation": "mutation file_token_Mutation(\n  $key: String\n) {\n  file_token(key: $key) {\n    token\n    id\n  }\n}\n",
    "main_userProfile_me_Query": "query main_userProfile_me_Query {\n  me {\n    id\n    username\n    birthday\n    gender\n    location\n    photo\n    signature\n  }\n}\n"	
}
