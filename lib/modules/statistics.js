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
            }
        `,
        resolver:{
            [TypedStatistics]:{
                id: ({_id})=>`${typedStatisticss}:${_id}`,
            },
            [Type]:fields.reduce((resolver,field)=>{
                resolver[field]=({_id},_,{app})=>app.getDataLoader("knowledgeStatisticss").load(_id).then(a=>a && a[field] || 0)
                return resolver
            },{}),
        }
    }
}