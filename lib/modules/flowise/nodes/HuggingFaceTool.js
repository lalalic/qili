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
                    options:Object.values(HuggingFaceToolNode.services)
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
        const {url, fn_index, 
            fn_indexes=[fn_index],
            session,
            outFormat=({data})=>data[0], 
            inFormat=({input})=>[input], 
            ...rest}=HuggingFaceToolNode.services[service]
        const tool= new DynamicTool({
            ...inputs,
            ...rest,
            async func(input){
                const hash={session_hash:session}
                let result=null
                for(let i=0;i<fn_indexes.length;i++){
                    hash.fn_index=fn_indexes[i]
                    const inputData=await inFormat({input, tool, i, session:hash.session_hash})
                    if(!hash.session_hash){
                        hash.session_hash=Math.random().toString(36).substring(2)
                    }
                    const data=await new Promise((resolve,reject)=>{
                        const ws=new WebSocket(url)
                        ws.onmessage=function(event){
                            const {msg, output} = JSON.parse(event.data);
                            switch (msg) {
                                case "send_hash":
                                    ws.send(JSON.stringify(hash));
                                    break;
                                case "send_data":
                                    ws.send(JSON.stringify({
                                        ...hash,
                                        data:inputData,
                                    }))
                                    break;
                                case "process_completed":
                                    resolve(output.data)
                                    return;
                                case "queue_full":
                                    resolve([])
                                default://"estimation","process_generating","process_starts"
                                    break;
                            }
                        }
                    })
                    result = await outFormat({data, tool, i, session:hash.session_hash})
                }
                return result
            }
        })

        return tool
    }
}

HuggingFaceToolNode.services={
    Text2Image:{
        label:"Text2Image",
        name:"Text2Image",
        description:"generate image from text",
        url: "wss://runwayml-stable-diffusion-v1-5.hf.space/queue/join",
        fn_index:1,
        async outFormat({data,tool}){
            const images=data[0], now=Date.now()
            const urls=await Promise.all(
                images.map((image,i)=>{
                    return tool.qili.upload({uri:image, key:`$temp/1/${now}/${i}`})
                })
            )
            return urls.join(",")
        }
    }
}

module.exports={nodeClass:HuggingFaceToolNode}