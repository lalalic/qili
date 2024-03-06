const { getBaseClasses, getCredentialData, getCredentialParam }=require("flowise-components/dist/src/utils")
const { ChatBaiduWenxin } =require("./core")
class Node{
    constructor(){
        this.label = 'baidu'
        this.name = 'wenxin'
        this.version = 1.0
        this.type = 'baiduwenxin'
        this.icon = 'fake.svg'
        this.category = 'Chat Models'
        this.description = 'Chat completion using baidu wenxin'
        this.baseClasses = [this.type, ...getBaseClasses(ChatBaiduWenxin)]
        this.credential = {
            label: 'Connect Credential',
            name: 'credential',
            type: 'credential',
            credentialNames: ['baiduApi']
        }
        this.inputs = [
            {
                label: 'Model Name',
                name: 'modelName',
                ype: 'options',
                default: 'ERNIE-Bot-turbo',
                options:[
                    {label:"ERNIE-Bot",name:"ERNIE-Bot"},
                    {label:'ERNIE-Bot-turbo',name:"ERNIE-Bot-turbo"},
                    {label:"ERNIE-Bot-4",name:"ERNIE-Bot-4"}
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
                label: 'Top P',
                name: 'topP',
                type: 'number',
                description:
                    'Works together with top-k. A higher value (e.g., 0.95) will lead to more diverse text, while a lower value (e.g., 0.5) will generate more focused and conservative text. (Default: 0.9). Refer to <a target="_blank" href="https://github.com/jmorganca/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values">docs</a> for more details',
                step: 0.1,
                optional: true,
                additionalParams: true
            },
            {
                label: 'Penalty Score',
                name: 'penaltyScore',
                type: 'number',
                description:
                    'Reduces the probability of generating nonsense. A higher value (e.g. 100) will give more diverse answers, while a lower value (e.g. 10) will be more conservative. (Default: 40). Refer to <a target="_blank" href="https://github.com/jmorganca/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values">docs</a> for more details',
                step: 1,
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
            },
            {
                label: 'User ID',
                name: 'userId',
                type: 'string',
                optional: true,
                additionalParams: true
            }
        ]
    }

    async init(nodeData, request, options, qili, flowise){
        const {userId, prefixMessages, penaltyScore, topP, temperature, modelName}=nodeData.inputs
        const credentialData = await getCredentialData(nodeData.credential ?? '', options)
        const baiduApiKey = getCredentialParam('baiduApiKey', credentialData, nodeData)
        const baiduSecretKey = getCredentialParam('baiduSecretKey', credentialData, nodeData)
        const ctx=flowise.extractRunMetadata(options)
        
        return new ChatBaiduWenxin({
            modelName,prefixMessages:[prefixMessages],
            baiduApiKey, baiduSecretKey, userId,
            penaltyScore, topP, temperature, 
        })
    }
}

module.exports={nodeClass:Node}

//apiKey:ALTAKQG2PIi97fipjaVcfxMI3O
//secretKey: 94afb49f3c284d7da1a9255702487bee