const monkeyIntercept=require('../monkey-intercept')
module.exports={
    qiliTool:require("./HuggingFace"),

    anyFile(node, flowise){
        const fileTypes=Object.values(flowise.nodesPool.componentNodes)
            .filter(a=>a.category=="Document Loaders" && a!=node)
            .map(a=>a.inputs.find(b=>b.type=="file")?.fileType)
            .filter(a=>!!a)
            .join(",")
        const param=node.inputs.find(a=>a.type=="file")
        param.fileType=fileTypes
        param.label=`${param.label} (${fileTypes})`
    },

    chatOpenAI(node, flowise){
        node.inputs.splice(1,0,{
            label:"Streaming",
            name:"streaming",
            type:"boolean",
            default:true,
            additionalParams:true,
            optional:true
        })
    },

    openAIEmbeddings(node, flowise){
        monkeyIntercept(node.constructor.prototype, 'init', init=>async function(){
            const embedding=await init.call(this, ...arguments)
            monkeyIntercept(embedding.caller, 'call', fx=>async function(){
                const res=await fx.call(this, ...arguments)
                embedding.tokensUsage={prompt:res.usage.prompt_tokens,completion:0, model:res.model}
                return res
            })
            return embedding
        })
    }
}