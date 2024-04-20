const { LLM }=require("langchain/llms/base")
const { getBaseClasses } =require("flowise-components/dist/src/utils")
class FakeLLMNode{
    constructor(){
        this.label = 'Fake LLM'
        this.name = 'fakeLLM'
        this.version = 1.0
        this.type = 'FakeLLM'
        this.icon = `fake.svg`
        this.category = 'LLMs'
        this.description = 'A fake LLM for testing purposes'
        this.baseClasses = [this.type, ...getBaseClasses(LLM)]
        this.inputs = [
            {
                label: 'Response',
                name: 'response',
                type: 'string',
                default: 'Good day!'
            }
        ]
    }

    async init({inputs:{response}}, request, options){
        return new FakeLLM({response})
    }
}

class FakeLLM extends LLM{
    static lc_name() {
        return "FakeLLM";
    }

    constructor({response}){
        super({})
        this.response=response
    }

    _llmType() {
        return "fakeLLM";
    }

    _call(prompt){
        return Promise.resolve({text:this.response || prompt})
    }
}

module.exports={nodeClass:FakeLLMNode, FakeLLM}