exports.typeDefs=`
	schema {
		query: Query
		mutation: Mutation
	}
	
    scalar Date
	
	interface Named{
		_id: String!
		name: String
		photo(size: Int=25): String
	}
	
	type User implements Named{
		_id: String!
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
    }
	
	type Mutation{
		requestToken(contact: String!): Boolean
		login(contact: String!, token: String!): User
		logout:Boolean
	}
`

exports.resolver={
	Date:{
		parseValue(value) {
		  return new Date(value); // value from the client
		},
		serialize(value) {
		  return value.getTime(); // value sent to the client
		},
		parseLiteral(ast) {
		  if (ast.kind === Kind.INT) {
			return parseInt(ast.value, 10); // ast value is always in string format
		  }
		  return null;
		}
	},
	Query: {
		version:()=>"2.0.1"
	},
	User:{
		token(user,args,{app}){
			return app.encode(user)
		}
	},
	Mutation: {
		requestToken(root,{contact},{app}){
			return app.requestToken(contact)
		},
		login(root, {token,contact}, {app}){
			return app.login(contact,token)
		},
		logout:(_,a,{app,user})=>app.logout(user)
	}
}
