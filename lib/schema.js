const {ObjectID}=require("mongodb")
ObjectID.prototype.toString=ObjectID.prototype.toHexString

exports.typeDefs=`
	schema {
		query: Query
		mutation: Mutation
	}

    scalar Date

	scalar ObjectID
	
	interface Node {
		id: ID!
	}

	interface Named{
		_id: ObjectID!
		name: String
		photo(size: Int=25): String
	}

	type User implements Node, Named{
		id: ID!
		_id: ObjectID!
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
	
	input requestTokenInput{
		contact: String!
	}
	
	input loginInput{
		contact: String! 
		token: String! 
		name: String
	}

	type Mutation{
		requestToken(data: requestTokenInput!): Boolean
		login(data: loginInput): User
		logout:Boolean
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
			try{
				return new ObjectID(value); // value from the client
		  	}catch(e){
				return value
			}
		},
		serialize(value) {
			return value.toString()
		}
	},

	Query: {
		version:()=>"2.0.1",
		async node(_,{id}, {app}){
			let [col, _id]=id.split(":")
			_id=exports.resolver.ObjectID.parseValue(_id)
			return await app.get1Entity(col, {_id})
		},
		schema(_,{},{app}){
			return require("graphql/utilities").printSchema(app.schema)
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
		requestToken(root,{data:{contact}},{app}){
			return app.requestToken(contact)
		},
		login(root, {data:{token,contact,name}}, {app}){
			return app.login(contact,token,name)
		},
		logout:(_,a,{app,user})=>app.logout(user)
	}
}
