const SCHEMA=exports.schema=`
    type Application{
        _id: ID!
        apiKey: String!
        token: String!
        name: String!
        author: User!
        createdAt: Date!
        updatedAt: Date
    }

	type User{
		_apps: [Application]!
	}

	type Mutation{
		createApplication(name:String!): Application
		updateApplication(id: ID!, name:String): Date
	}

	type Query{
		version: String!
	}
`

const RESOLVER=exports.resolver={

}