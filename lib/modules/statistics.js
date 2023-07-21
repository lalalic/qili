exports.name="statistics"
exports.build=function(Type, fields){
    const TypedStatistics=`${Type}Statistics`
    const fieldDefs=fields.map(a=>`${a}: Int`).join("\n\r")
    return {
        typeDefs:`
            type ${TypedStatistics} implements Node{
                id: ID!
                ${fieldDefs}
            }

            extend type ${Type}{
                ${fieldDefs}
                """use query to auto count: _viewed in your query to inc viewed automatically"""
                ${fields.map(a=>`_${a}: Boolean`).join("\n\r")}
            }
        `,
        resolver:{
            [TypedStatistics]:{
                id: require("./schema").ID,
            },

            [Type]:fields.reduce((resolver,field)=>{
                resolver[field]=({_id},_,{app})=>{
                    return app.getDataLoader(TypedStatistics)
                        .load(_id)
                        .then(a=>a && a[field] || 0)
                }
                
                resolver[`_${field}`]=({_id},_,{app})=>{
                    exports.statistics(Type,{_id,[field]:1},{app})
                    return true
                }

                return resolver
            },{}),
        },
        indexes:{
            
        }
    }
}

exports.statistics=function(Type, {_id, ...$inc}, {app}){
    const TypedStatistics=`${Type}Statistics`
    return app.getDataLoader(TypedStatistics).load(_id).then(a=>{
        if(a){
            return app.updateEntity(TypedStatistics,{_id},{$inc})
        }else{
            return app.createEntity(TypedStatistics,{_id, ...$inc})
        }
    })
}