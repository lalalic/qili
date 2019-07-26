exports.build=function(Type){
    const type=Type[0].toLowerCase()+Type.substr(1)
    const types=`${type}s`
    const TypedFavorite=`${Type}Favorite`
    const typedFavorite=`${type}Favorite`
    const typedFavorites=`${typedFavorite}s`
    return {
        typeDefs:`
            type ${TypedFavorite} implements Node{
                id: ID!
                author: User!
                ${type}: ${Type}!
            }

            extend type User{
                ${typedFavorites}:[${Type}]
            }

            extend type ${Type}{
                isMyFavorite: Boolean
                favoriterCount: Int
            }

            extend type Mutation{
                ${typedFavorite}_toggle(_id:ObjectID!): ${Type}
            }
        `,
        resolver:{
            [TypedFavorite]:{
                id: ({_id})=>`${typedFavorites}:${_id}`,
                author({author},_,{app,user}){
                    return app.getDataLoader("users").load(author)
                },
                [type]:({favorite:_id},_,{app})=>{
                    return app.get1Entity(types,{_id})
                },
            },
            User:{
                [`${typedFavorite}s`]:({},_,{app,user})=>{
                    return app.findEntity(types,{author:user._id})
                }
            },
            [Type]:{
                isMyFavorite({_id,favoriting},_,{app,user}){
                    if(typeof(favoriting)!='undefined')
                        return !!favoriting

                    return app.get1Entity(typedFavorites,{[type]:_id, author:user._id}).then(a=>!!a)
                },
                async favoriterCount({_id},_,{app}){
                    const conn=await app.collection(typedFavorites)
                    try{
                        return conn.count({[type]:_id})
                    }catch(e){
                        console.error(e)
                    }finally{
                        conn.close()
                    }
                }
            },
            Query:{
                
            },
            Mutation:{
                [`${typedFavorite}_toggle`](_,{_id},{app,user}){
                    return app.get1Entity(typedFavorites,{[type]:_id, author:user._id})
                        .then(a=>{
                            if(a){
                                return app.remove1Entity(typedFavorites, {_id:a._id,author:user._id})
                                    .then(()=>({_id,favoriting:false}))
                            }else{
                                return app.createEntity(typedFavorites, {author:user._id, [type]:_id})
                                    .then(a=>({_id:a._id, favoriting:true}))
                            }
                        })
                }
            }
        }
    }
}