const { DynamicTool} = require('langchain/tools')
const { getBaseClasses }=require("flowise-components/dist/src/utils")
const { HfInference } =require( "@huggingface/inference")

let inference = new HfInference("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")

class Node{
    constructor(){
        Object.assign(this,{
            label:"HuggingFace Task",
            name:"hfTask",
            type:"HFTask",
            category:"Tools",
            version:"1.0",
            description:"Tasks",
            icon:`qili-ai.svg`,
            inputs:[
                {
                    label:"Task",
                    name:"task",
                    type:"asyncOptions",
                    optional:false,
                    loadMethod:"listTasks"
                },
                {
                    label:"Model",
                    name:"model",
                    type:"string",
                    optional:true,
                    additionalParams:true
                },
                {
                    label:"Parameters",
                    name:"parameters",
                    type:"json",
                    optional:true,
                    additionalParams:true
                }
            ]
        })
        this.baseClasses=[this.type, ...getBaseClasses(DynamicTool)]
        this.loadMethods={
            listTasks(){
                return Object.getOwnPropertyNames(inference)
                    .filter(a=>typeof(inference[a])=="function")
                    .map(name=>({label:name, name}))
            }
        }
    }


    async init({inputs:{task,model,parameters}},_, options, qili, flowise){
        if(!inference)
            inference=HfInference(flowise.HF_TOKEN)

        const tool= new DynamicTool({
            name: task, 
            description: task,
            returnDirect:true,
            async func(inputs, runManager){
                try{
                    return inference[task]({inputs, parameters, data:inputs, model})
                }catch(e){
                    return e.error ?? e.message
                }
            }
        })

        return tool
    }
}

module.exports={nodeClass:Node}