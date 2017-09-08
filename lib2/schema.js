const typeDefs=`
    scalar Date

    type AccountID{
        email: String
        phone: String
    }

    type User{
        _id: ID!
        createdAt: Date!
        updatedAt: Date
        aid: AccountID!
        name: String
    }

    type Role{
        _id: ID!
        createdAt: Date!
        updatedAt: Date
    }

    type Message{
        url: String!
        remote: String!
        method: String!
        path: String!
        httpVersion: String!
        contentLength: Int!
        status: Int!
    }

    type Log{
        _id: ID!
        createdAt: Date!
        level: Int!
        message: Message!
    }

    type Query{
        me{
            ...User
        }
    }

    type Mutation{

    }
`

const resolvers={
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

    AccountID:{

    }
}

export default {typeDefs, resolvers}
