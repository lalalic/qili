const {Kind} = require("graphql/language")

const SCHEMA=exports.schema=`
    scalar Date
`

const RESOLVER=exports.resolver={
    Date: {
        parseValue(value){
            return new Date(value)
        },
        serialize(value){
            return value.getTime()
        },
        parseLiteral(ast){
            if (ast.kind === Kind.INT) {
                return parseInt(ast.value, 10); // ast value is always in string format
            }
            return null;
        }
    }
}