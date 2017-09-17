const {ObjectID}=require("mongodb")
exports.typeDefs=`
	schema {
		query: Query
		mutation: Mutation
	}

    scalar Date

	scalar ObjectID

	interface Named{
		_id: ObjectID!
		name: String
		photo(size: Int=25): String
	}

	type User implements Named{
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
    }

	type Mutation{
		requestToken(contact: String!): Boolean
		login(contact: String!, token: String!, name: String): User
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
		  return value.toHexString(); // value sent to the client
		}
	},

	Query: {
		version:()=>"2.0.1"
	},
	User:{
		name(user){
			return user.name||user.username
		},
		token(user,args,{app}){
			return app.encode(user)
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
	}
}
