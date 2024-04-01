const { FakeChatModel }=require("./FakeChatModel")
class Node{
    constructor(){
        this.label = 'Chat Model Proxy'
        this.name = 'chatModelProxy'
        this.version = 1.0
        this.type = 'chat-model-proxy'
        this.icon = 'fake.svg'
        this.category = 'Chat Models'
        this.description = 'Select chat model according to conditions'
        this.baseClasses = ['BaseChatModel','BaseLanguageModel','Runnable']
        this.inputs=[
            {
                label:"models",
                name: "models",
                type: "BaseChatModel",
                list: true
            },
            {
                label: "Default Model",
                name:"selectedModel",
                type:"options",
                options:[],
                optionsFrom:"models",
                optional: true,
            },
            {
                label: "Auto Select By Country",
                name:"autoSelectModel",
                type:"boolean",
                optional: true,
                additionalParams:true
            },
            {
                label: "Proxy Auto Configuration",
                name:"pac",
                type:"string",
                optional:true,
                additionalParams:true
            }
        ]
        this.loadMethods={
            listAllModels(nodeData){
                return nodeData.inputs.models.map(a=>({label:a.label, name: a.name}))
            }
        }
    }

    select({inputs:{models=[],selectedModel, autoSelectModel, pac}}, request, options, qili, flowise){
        if(autoSelectModel){ 
            const ctx=flowise.extractRunMetadata(options)

        }else if(selectedModel){
            return models.find(a=>a.metadata.node.id==selectedModel)
        }
        return models[0]
    }

    init({inputs:{models=[],selectedModel, autoSelectModel, pac}}, request, options, qili, flowise){
        const model=this.select(...arguments);
        return model || new FakeChatModel({response:"from fake chat model"})
    }
}

module.exports={nodeClass:Node}