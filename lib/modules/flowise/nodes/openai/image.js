const { Readable } = require('stream')
const { getBaseClasses, getCredentialData, getCredentialParam }=require("flowise-components/dist/src/utils")
const { DynamicTool} = require('langchain/tools')
const OpenAI =require('openai')

class Node{
    constructor(){
        Object.assign(this,{
            label:"Text to Image",
            name:"openaiDalle",
            type:"OpenAIDalle",
            category:"Tools",
            version:"1.0",
            description:"good to generate Image with prompt",
            icon:'openai.png',
            baseClasses:[this.type, ...getBaseClasses(DynamicTool)],
            credential: {
                label: 'Connect Credential',
                name: 'credential',
                type: 'credential',
                credentialNames: ['openAIApi']
            },
            inputs:[
                {
                    label:"Model",
                    name:"model",
                    type:"options",
                    optional:false,
                    additionalParams:true,
                    options: [
                        {
                            label: 'dalle 2',
                            name: 'dall-e-2'
                        },
                        {
                            label: 'dalle 3',
                            name: 'dall-e-3'
                        }
                    ],
                    default: 'dall-e-2',
                },
                {
                    label: 'Prompt',
                    name: 'prompt',
                    type: 'BasePromptTemplate',
                    additionalParams:true,
                },
                {
                    label:"N",
                    name:"n",
                    type:"number",
                    optional:true,
                    default:1,
                    additionalParams:true,
                    description:"Only for Dall-e-2",
                },
                {
                    label:"Size",
                    name:"size",
                    type:"options",
                    optional:true,
                    default:"1024x1024",
                    additionalParams:true,
                    options:"1024x1024,256x256, 512x512,  1024x1792, 1792x1024".split(",").map(a=>({label:a, name:a.trim()}))
                },
                {
                    label:"Quality",
                    name:"quality",
                    type:"options",
                    optional:true,
                    default:"standard",
                    additionalParams:true,
                    description:"Only for Dall-e-3",
                    options:[
                        {label:"Standard",name:"standard"},
                        {label:"Enhanced", name:"hd"}
                    ]
                },
            ]
        })
    }

    async init({inputs, credential}, prompt, options, qili, flowise){
        const credentialData = await getCredentialData(credential, options)
        const apiKey = getCredentialParam('openAIApiKey', credentialData, arguments[0])
        const openai=new OpenAI({apiKey})
        const me=this
        const tool= new DynamicTool({
            name:this.name, 
            description:this.description,
            inputs: this.inputs,
            returnDirect:true,
            async func(prompt, runManager){
                const res=await this.openai.images.generate({...me.clean(inputs), prompt})
                return {output:res.data.map(a=>`![${prompt}](${a.url})`).join(" ")}
            }
        })
        tool.openai=openai
        return tool
    }

    clean(ob){
        return Object.keys(ob).reduce((all,key)=>{
            if(ob[key]!==""){
                all[key]=ob[key]
            }
            return all
        },{})
    }

    asUploadable(dataUri, name="a"){
        return {
            url:`https://a.com/${name}`,
            blob(){
                const [procol,base64Data]=dataUri.split(",")
                const [,type,]=procol.split(/[:;]/)
                const buffer=Buffer.from(base64Data, 'base64')
                return new Blob([buffer],{type})
            }
        }
    }
}

module.exports={nodeClass:Node}