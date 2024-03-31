const { BaseLLM }=require("langchain/llms/base")
const { getBaseClasses }=require("flowise-components/dist/src/utils")
const { nodeClass: ChatModelProxy} = require("./chat-model-proxy")
const { FakeLLM }=require("./FakeLLM")

class Node extends ChatModelProxy{
    constructor(){
        super(...arguments)
        this.label = 'LLM Proxy'
        this.name = 'llmProxy'
        this.version = 1.0
        this.type = 'llm-proxy'
        this.icon = 'fake.svg'
        this.category = 'LLMs'
        this.description = 'Select chat model according to conditions'
        this.baseClasses = ['BaseLLM']
        this.inputs.find(a=>a.name=="models").type="BaseLLM"
        this.listMethods={
            listAllModels(nodeData){
                return nodeData.inputs.models.map(a=>({label:a.label, name: a.name}))
            }
        }
    }

    init(){
        const model=this.select(...arguments);
        return model || new FakeLLM({response:"from fake chat model"})
    }
}

module.exports={nodeClass:Node}