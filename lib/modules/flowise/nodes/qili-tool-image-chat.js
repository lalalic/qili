const { DynamicTool} = require('langchain/tools')
const QiliTool=require('./qili-tools')

class Node extends QiliTool.nodeClass{
    constructor(){
        super(...arguments)
        Object.assign(this,{
            name:"Image2Chat",
            label:"Image2Chat",
            description:"good for image description, details, good for chat about an image. the chat starts with an image url.",
            type:"Image2Chat",
            inputs:[
                {
                    label: 'Memory',
                    name: 'memory',
                    type: 'BaseChatMemory'
                },
                {
                    label: 'Temperature',
                    name: 'temperature',
                    type: 'number',
                    optional:true,
                    additionalParams:true,
                    default:0.2
                },{
                    label: 'Top P',
                    name: 'topP',
                    type: 'number',
                    optional:true,
                    additionalParams:true,
                    default:0.7,
                },{
                    label: 'Max Output Tokens',
                    name: 'maxOutputTokens',
                    type: 'number',
                    optional:true,
                    additionalParams:true,
                    default: 512
                },
            ]
        })
        this.baseClasses=[this.type, ...this.baseClasses.slice(1)]
    }

    async init({inputs:{memory,temperature,topP, maxOutputTokens, ...inputs}},_, options, qili){
        const me=this
        const tool= new DynamicTool({
            name:this.name, 
            description:this.description,
            returnDirect:true,
            async func(input, runManager){
                const url="wss://badayvedat-llava.hf.space/queue/join"
                if(input.startsWith('data:')){//image data
                    const imageDataURI=input
                    const session=Math.random().toString(36).substring(2)
                    await me.send({
                        url,
                        input:[,"",imageDataURI,'Default'], 
                        session,
                        fn_index:9
                    })
                    const {output}=await me.send({
                        url,
                        input: [,"llava-v1.5-13b-4bit",temperature,topP,maxOutputTokens],
                        session,
                        fn_index:10
                    })
                    return {output:`[${output[1]?.[0]?.reverse().find(a=>!!a)||""}](#Tool?name=${me.name}&session=${session})`}
                } else {//input is question to model
                    let session=null
                    const messages=memory.chatHistory.messages
                    messages.reverse().find(a=>{
                        if(a._getType()=="ai"){
                            const matched=a.content.match(/\[.*\]\(\#Tool\?name=(?<toolName>.*)\&session=(?<session>.*)\)/)
                            if(matched && matched.groups.toolName==me.name){
                                return session=matched.groups.session
                            }
                        }
                    })

                    if(!session){
                        return "No image to talk about"
                    }

                    return me.send({
                        url,
                        fn_index:7,
                        session,
                        input:[,input,,'Default'],
                        outFormat({data}){
                            return {output:data[1]?.[0]?.reverse().find(a=>!!a)||""}
                        }
                    }, runManager)
                }
            }
        })

        tool.qili=qili

        return tool
    }
}

module.exports={nodeClass:Node}