const { getBaseClasses }=require("flowise-components/dist/src/utils")
const { DynamicTool} = require('langchain/tools')
const { WebSocket }=require('ws')

class HuggingFaceToolNode{
    constructor(){
        Object.assign(this,{
            label:"HuggingFace Service",
            name:"huggingFace",
            type:"HuggingFace",
            category:"Tools",
            version:"1.0",
            description:"HuggingFace services",
            icon:`${__dirname}/huggingface.svg`,
            inputs:[
                {
                    label:"Service",
                    name:"service",
                    type:"options",
                    optional:false,
                    options:Object.values(services)
                },
                {
                    label:"return direct",
                    name:"returnDirect",
                    type:"boolean",
                    default:true
                },
            ]
        })
        this.baseClasses=[this.type, ...getBaseClasses(DynamicTool)]
    }

    async init({inputs:{service,...inputs}},_, options){
        const {url, fn_index, outFormat=data=>data[0], ...rest}=services[service]
        const tool= new DynamicTool({
            ...inputs,
            ...rest,
            async func(input){
                const session_hash=Math.random().toString(36).substring(2)
                const hash={session_hash,fn_index}
                return new Promise((resolve,reject)=>{
                    const ws=new WebSocket(url)
                    ws.onmessage=function(event){
                        const {msg, output} = JSON.parse(event.data);
                        switch (msg) {
                        case "send_data":
                            ws.send(JSON.stringify({
                                ...hash,
                                data:[input],
                            }))
                            break;
                        case "send_hash":
                            ws.send(JSON.stringify(hash));
                            break;
                        case "process_completed":
                            resolve(output.data)
                            return;
                        case "queue_full":
                            return;
                        case "estimation":
                            break;
                        case "process_generating":
                            break;
                        case "process_starts":
                            break
                        }
                    }
                }).then(async data=>{
                    try{
                        return await outFormat(data, tool)
                    }catch(e){
                        return `error: ${e.message}`
                    }
                })
            }
        })

        return tool
    }
}

const services={
    Text2Image:{
        label:"Text2Image",
        name:"Text2Image",
        description:"generate image from text",
        url: "wss://runwayml-stable-diffusion-v1-5.hf.space/queue/join",
        fn_index:1,
        async outFormat(data,tool){
            const images=data[0], now=Date.now()
            const urls=await Promise.all(
                images.map((image,i)=>{
                    return tool.qili.upload({uri:image, key:`$temp/1/${now}/${i}`})
                })
            )
            return urls.join(",")
        }
    },

    ImagePromptEx:{
        label:"Enhance Prompt",
        name:"ImagePromptEx",
        description:"enhance image prompt",
        url: "wss://gustavosta-magicprompt-stable-diffusion.hf.space/queue/join",
        fn_index:0,
    }
}

module.exports={nodeClass:HuggingFaceToolNode}