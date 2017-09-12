exports.schema=`
    scalar Date

    type User{
        _id: ID!
		email: String
		phone: String
		username: String
		createdAt: Date!
		updatedAt: Date
		token: String
		roles: [Role]
    }

	type Role{
        _id: String!
        createdAt: Date!
        updatedAt: Date
		author: User
		users: [User]
    }

    type Log{
        _id: ID!
        createdAt: Date!
        author: User!
		operationName: String!
		variables: [String]!
    }

    type Query{
		version: String!
        me:User!
    }
	
	type Mutation{
		logout:Boolean
		role_create(name:String):Role
		role_update(_id:String!,name:String):Date
		role_remove(_id:String!):Boolean
		role_user_add(_id:String!, users: [String!]!): [String]!
		Role_user_remove(_id:String!, users: [String!]!): [String]!
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
		version:()=>"2.0.1",
		me:async (_,a,{app,{_id}})=>{
			let conn=await app.collection("users")
			try{
				return await conn.findOne({_id})
			}finally{
				conn.close()
			}
		}
	},
	Mutation:{
		logout:(_,a,{app,user})=>app.logout(user),
		...require("./role").resolver
	}
}
