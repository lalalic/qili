exports.build=function(Type, fields){
    const type=Type[0].toLowerCase()+Type.substr(1)
    const types=`${type}s`
    const TypedStatistics=`${Type}Statistics`
    const typedStatistics=`${type}Statistics`
    const typedStatisticss=`${typedStatistics}s`
    const fieldDefs=fields.map(a=>`${a}: Int`).join("\n\r")
    return {
        typeDefs:`
            type ${TypedStatistics} implements Node{
                id: ID!
                ${fieldDefs}
            }

            extend type ${Type}{
                ${fieldDefs}

                ${fields.map(a=>`_${a}: Boolean`).join("\n\r")}
            }
        `,
        resolver:{
            [TypedStatistics]:{
                id: ({_id})=>`${typedStatisticss}:${_id}`,
            },

            [Type]:fields.reduce((resolver,field)=>{
                resolver[field]=({_id},_,{app})=>{
                    return app.getDataLoader(typedStatisticss)
                        .load(_id)
                        .then(a=>a && a[field] || 0)
                }
                
                resolver[`_${field}`]=({_id},_,{app})=>{
                    exports.statistics(types,{_id,[field]:1},{app})
                    return true
                }

                return resolver
            },{}),
        }
    }
}

exports.statistics=function(types, {_id, ...$inc}, {app}){
    const typedStatisticss=`${types.substring(0,types.length-1)}Statisticss`
    return app.getDataLoader(typedStatisticss).load(_id).then(a=>{
        if(a){
            return app.updateEntity(typedStatisticss,{_id},{$inc})
        }else{
            return app.createEntity(typedStatisticss,{_id, ...$inc})
        }
    })
}