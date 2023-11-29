const { SimpleChatModel } = require('langchain/chat_models/base')
const { getBaseClasses } =require("flowise-components/dist/src/utils")

class FakeChatModelNode{
    constructor(){
        this.label="Fake ChatModel"
        this.name = 'fakeChatModel'
        this.type = 'FakeChatModel'
        this.version = 1.0
        this.category = 'Chat Models'
        this.icon=`fake.svg`
        this.description= 'A fake chat model for test'
        this.baseClasses = [this.type, ...getBaseClasses(SimpleChatModel)]
        this.inputs=[
            {
                label: 'Response',
                name: 'response',
                type: 'string',
                default: 'Good day!'
            }
        ]
    }

    async init({inputs:{response}}, request, options){
        return new FakeChatModel({response})
    }
}

class FakeChatModel extends SimpleChatModel{
    static lc_name() {
        return "FakeChatModel";
    }

    constructor({response}){
        super({})
        this.response=response
    }

    _llmType() {
        return "fakeChatModel"
    }

    _call(){
        return this.response
    }
}

module.exports={nodeClass:FakeChatModelNode}