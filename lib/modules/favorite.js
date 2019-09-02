const {statistics}=require("./statistics")

exports.build=function(Type, statisticsFieldName){
    const type=Type[0].toLowerCase()+Type.substr(1)
    const TypedFavorite=`${Type}Favorite`
    const typedFavorite=`${type}Favorite`
    return {
        typeDefs:`
            type ${TypedFavorite} implements Node{
                id: ID!
                author: User!
                ${type}: ${Type}!
            }

            extend type User{
                ${typedFavorite}s:[${Type}]
            }

            extend type ${Type}{
                isMyFavorite: Boolean
                ${!statisticsFieldName ? "favorited: Int" : ""}
            }

            extend type Mutation{
                ${typedFavorite}_toggle(_id:ObjectID!): ${Type}
            }
        `,
        indexes:{
            [TypedFavorite]:[
                {author:1}
            ]
        },
        resolver:{
            [TypedFavorite]:{
                id: require("../schema").ID,
                author({author},_,{app,user}){
                    return app.getDataLoader("User").load(author)
                },
                [type]:({favorite:_id},_,{app})=>{
                    return app.get1Entity(Type,{_id})
                },
            },
            User:{
                [`${typedFavorite}s`]:({},_,{app,user})=>{
                    return app.findEntity(Type,{author:user._id})
                }
            },
            [Type]:Object.assign({
                isMyFavorite({_id,favoriting},_,{app,user}){
                    if(typeof(favoriting)!='undefined')
                        return !!favoriting

                    return app.get1Entity(TypedFavorite,{[type]:_id, author:user._id}).then(a=>!!a)
                }
                },statisticsFieldName ? {} : {//if statistics doesn't count favoirted, 
                async favorited({_id},_,{app}){
                    const conn=await app.collection(TypedFavorite)
                    try{
                        return conn.count({[type]:_id})
                    }catch(e){
                        console.error(e)
                    }finally{
                        conn.close()
                    }
                }
            }),
            Query:{
                
            },
            Mutation:{
                [`${typedFavorite}_toggle`](_,{_id},{app,user},{schema}){
                    return app.get1Entity(TypedFavorite,{[type]:_id, author:user._id})
                        .then(a=>{
                            if(a){
                                return app.remove1Entity(TypedFavorite, {_id:a._id,author:user._id})
                                    .then(()=>{
                                        if(statisticsFieldName){
                                            statistics(Type,{_id,[statisticsFieldName]:-1},{app,user})
                                        }
                                        return {_id,favoriting:false}
                                    })
                            }else{
                                return app.createEntity(TypedFavorite, {author:user._id, [type]:_id})
                                    .then(a=>{
                                        if(statisticsFieldName){
                                            statistics(Type,{_id,[statisticsFieldName]:1},{app,user})
                                        }
                                        return {_id:a._id, favoriting:true}
                                    })
                            }
                        })
                }
            }
        }
    }
}

