const { getBaseClasses, getCredentialData, getCredentialParam }=require("flowise-components/dist/src/utils")
const { ChatAlibabaTongyi } =require("./core")
class Node{
    constructor(){
        this.label = 'ali'
        this.name = 'tongyi'
        this.version = 1.0
        this.type = 'alitongyi'
        this.icon = 'fake.svg'
        this.category = 'Chat Models'
        this.description = 'Chat completion using ali tongyi'
        this.baseClasses = [this.type, ...getBaseClasses(ChatAlibabaTongyi)]
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['aliApi']
        }

        this.inputs = [
            {
                label: 'Model Name',
                name: 'modelName',
                type: 'options',
                default: 'qwen-turbo',
                options:[
                    {label:"qwen",name:"qwen"},
                    {label:'qwen-turbo',name:"qwen-turbo"},
                    {label:'qwen-vl-plus', name:"qwen-vl-plus"},
                    {label:"qwen-plus",name:"qwen-plus"},
                    {label:'qwen-7b-chat',name:"qwen-7b-chat"},
                    {label:"qwen-14b-chat",name:"qwen-14b-chat"},
                ],
            },
            {
                label: 'Temperature',
                name: 'temperature',
                type: 'number',
                description:
                    'The temperature of the model. Increasing the temperature will make the model answer more creatively. (Default: 0.8). Refer to <a target="_blank" href="https://github.com/jmorganca/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values">docs</a> for more details',
                step: 0.1,
                default: 0.9,
                optional: true
            },
            {
                label: 'Streaming',
                name: 'streaming',
                type: 'boolean',
                default: false,
                optional: true,
                additionalParams:true,
            },
            {
                label: 'Top P',
                name: 'topP',
                type: 'number',
                default: 0.8, 
                optional: true,
                additionalParams: true
            },
            {
                label: 'Top K',
                name: 'topK',
                type: 'number',
                optional: true,
                additionalParams: true
            },
            {
                label: 'seed',
                name: 'seed',
                type: 'number',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Max Tokens',
                name: 'maxToken',
                type: 'number',
                optional: true,
                additionalParams: true
            },
            {
                label: 'Repetition Penalty',
                name: 'repetitionPenalty',
                type: 'number',
                default:1.0,
                optional: true,
                additionalParams: true
            },
            {
                label: 'System Message',
                name: 'prefixMessages',
                type: 'string',
                rows: 4,
                placeholder: 'AI assistant:',
                optional: true,
                additionalParams: true
            }
        ]
    }

    async init(nodeData, request, options, qili, flowise){
        const {prefixMessages, topP, topK, seed, maxTokens, repetitionPenalty, temperature, modelName}=nodeData.inputs
        const credentialData = await getCredentialData(nodeData.credential ?? '', options)
        const alibabaApiKey = getCredentialParam('alibabaApiKey', credentialData, nodeData)
        const ctx=flowise.extractRunMetadata(options)

        return new ChatAlibabaTongyi(clean({
            alibabaApiKey, modelName,
            prefixMessages:[prefixMessages], 
            topP, topK, seed, maxTokens, repetitionPenalty, temperature, 
        }))
    }
}

function clean(o){
    Object.keys(o).forEach(k=>{
        if(o[k]==undefined || o[k]==""){
            delete o[k]
        }
    })
    return o
}

module.exports={nodeClass:Node}