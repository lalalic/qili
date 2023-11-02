const { BaseLLM }=require("langchain/llms/base")
const { getBaseClasses } =require("flowise-components/dist/src/utils")
class FakeLLMNode{
    constructor(){
        this.label = 'Fake LLM'
        this.name = 'fakeLLM'
        this.version = 1.0
        this.type = 'FakeLLM'
        this.icon = `${__dirname}/bug.svg`
        this.category = 'LLMs'
        this.description = 'A fake LLM for testing purposes'
        this.baseClasses = [this.type, ...getBaseClasses(BaseLLM)]
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

class FakeLLM extends BaseLLM{
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

    _call(){
        return this.response
    }
}

module.exports={nodeClass:FakeLLMNode}