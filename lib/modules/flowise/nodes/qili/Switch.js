class Node{
    constructor(){
        this.label = 'Switch'
        this.name = 'Switch'
        this.version = 2.0
        this.type = 'Adaptable'
        this.icon = 'switch.svg'
        this.category = 'Tools'
        this.description = 'Select option according to conditions or specified'
        this.baseClasses = ['Tool','BaseChatModel','BaseLanguageModel','Runnable']
        this.inputs=[
            {
                label:"Options",
                name: "options",
                type: "Runnable",
                list: true,
            },
            {
                label: "Default",
                name:"selectedOption",
                type:"Runnable",
                optional: true,
            },
            {
                label: "Auto Configuration",
                name:"pac",
                type:"string",
                optional:true,
                additionalParams:true,
                description:"Select an option according to request context"
            },
            {
                label: "*Node type*",
                name:"nodeType",
                description:"Advanced User only: if options are any non-runnable type, such as Prompt",
                type:"string",
                optional: true,
                additionalParams:true,
            }
        ]
    }

    init({inputs:{options=[],selectedOption, pac}}, request, opt, qili, flowise){
        if(pac){ 
            const ctx=flowise.extractRunMetadata(opt)
            selectedOption=pac?.(ctx)
        }
        
        if(selectedOption){
            if(typeof(selectedOption)=="string"){
                return options.find(a=>a.metadata.node.id==selectedOption || a.name==selectedOption || a.metadata.node.name==selectedOption)
            }
        }
        return selectedOption
    }
}

module.exports={nodeClass:Node}