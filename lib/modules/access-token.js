const { v4: uuid } =require('uuid')

const Type="AccessToken"

exports.get=async function(app, _id){
    const doc=await app.get1Entity(Type,{_id})
    return doc?.token
}

Object.assign(exports, {
    name:"access-token-api",
    typeDefs:`
        type AccessToken{
            type: String!
            name: String!
            createdAt: Date
            updatedAt: Date
            hiddenID: String
        }

        extend type User{
            accessTokens(type:String):[AccessToken]
        }

        extend type Mutation{
            generateAccessToken(type:String,name:String!):String
            removeAccessToken(type:String, name:String!):Boolean
        }
    `,
    indexes:{
        AccessToken:[{token:1}, {type:1, name:1, author:1}, {author:1, type:1}]
    },

    resolver:{
        AccessToken:{
            hiddenID({_id}){
                return _id.substring(0,4)+'...'+_id.substring(_id.length-4)
            }
        },
        User:{
            accessTokens(_,{type="default"},{app,user}){
                return app.findEntity(Type,{author:user._id,type})
            }
        },
        Mutation:{
            async generateAccessToken(_, {type="default",name}, {app, user}){
                if(await app.get1Entity(Type, {type, name, author:user._id})){
                    throw new Error(`${name} already exists`)
                }

                const id=uuid()
                const token=app.encode({_id:user._id,type, accessTokenId:id},{expiresIn:'100y'})
                const doc={_id:id, token, type, name, author:user._id}
                
                await app.createEntity(Type, doc)
                return doc._id
            },

            async removeAccessToken(_,{type="default", name},{app,user}){
                await app.removeEntity(Type, {author:user._id, type, name})
                return true
            }
        }
    }
})