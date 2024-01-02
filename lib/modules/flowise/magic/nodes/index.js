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

    conversationalAgent(node){
        const modelInput=node.inputs.find(a=>a.name=="model")
        modelInput.type="BaseChatModel"//must be chat model
        modelInput.label="Chat Model"
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
        },'once')
    },

    autoGPT(node, flowise){
        monkeyIntercept(node.constructor.prototype, 'init', init=>async function(nodeData,input,options,qili,flowise){
            const instance=await init.call(this, ...arguments)
            const ctx=flowise.extractRunMetadata(options)
            monkeyIntercept(instance.chain, 'call', fx=>async function(){
                const res=await fx.call(this, ...arguments)
                if(ctx?.runMonitorSocket && res?.text){
                    flowise.socketServer?.to(ctx.runMonitorSocket).emit('apiMessage', {node:node.name, result:res.text})
                }
                return res
            })
            return instance
        },'once')
    },
    
    babyAGI(node){
        monkeyIntercept(node.constructor.prototype, 'init', init=>async function(nodeData,input,options,qili,flowise){
            const instance=await init.call(this, ...arguments)
            const ctx=flowise.extractRunMetadata(options)
            monkeyIntercept(instance,'printTaskList',fx=>function(){
                fx.call(this, ...arguments)
                if(ctx?.runMonitorSocket){
                    flowise.socketServer?.to(ctx.runMonitorSocket).emit('apiMessage', {node:node.name, taskList:this.taskList})
                }
            })

            monkeyIntercept(instance,'executeTask',fx=>async function(){
                const res=await fx.call(this, ...arguments)
                if(ctx?.runMonitorSocket){
                    flowise.socketServer?.to(ctx.runMonitorSocket).emit('apiMessage', {node:node.name, task:arguments[4], result:res})
                }
                return res
            })

            return instance
        },'once')
    }
}