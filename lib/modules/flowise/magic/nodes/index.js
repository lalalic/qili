const monkeyIntercept=require('../monkey-intercept')

module.exports={
    huggingFace:require("./HuggingFace"),
    RedisUpsert(node){
        monkeyIntercept(node.constructor.prototype, 'init', init=>async function(nodeData){
            nodeData.inputs.redisUrl="redis://qili.pubsub"
            return await init.call(this, ...arguments)
        })
    },
    RedisIndex(node){
        monkeyIntercept(node.constructor.prototype, 'init', init=>async function(nodeData){
            nodeData.inputs.redisUrl="redis://qili.pubsub"
            return await init.call(this, ...arguments)
        })
    },

    anyFile(node, flowise){
        const fileTypes=Object.values(flowise.nodesPool.componentNodes)
            .filter(a=>a.category=="Document Loaders" && a!=node)
            .map(a=>a.inputs.find(b=>b.type=="file")?.fileType)
            .filter(a=>!!a)
            .join(",")
        const param=node.inputs.find(a=>a.type=="file")
        param.fileType=fileTypes
        param.label=`${param.label} (${fileTypes})`
    }
}