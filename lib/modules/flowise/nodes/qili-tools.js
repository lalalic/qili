const { getBaseClasses }=require("flowise-components/dist/src/utils")
const { DynamicTool} = require('langchain/tools')
const { WebSocket }=require('ws')

class Node{
    constructor(){
        Object.assign(this,{
            label:"Qili Tool",
            name:"qiliTool",
            type:"QiliTool",
            category:"Tools",
            version:"1.0",
            description:"Qili Tools",
            icon:`qili-ai.svg`,
            inputs:[
                {
                    label:"Service",
                    name:"service",
                    type:"options",
                    optional:false,
                    options:Object.values(Node.services)
                }
            ]
        })
        this.baseClasses=[this.type, ...getBaseClasses(DynamicTool)]
    }

    async init({inputs:{service,memory,...inputs}},_, options, qili){
        const {
            outFormat=({data})=>data[0], 
            inFormat=({input})=>[input], 
            inputs:_1, name, description,
            ...rest}=Node.services[service]
        const me=this
        const tool= new DynamicTool({
            name, description,
            returnDirect:true,
            async func(input, runManager){
                try{
                    return me.send({...rest,input,outFormat,inFormat, qili}, runManager)
                }catch(e){
                    return e.error ?? e.message
                }
            }
        })

        return tool
    }

    async send({url,input, session=Math.random().toString(36).substring(2), fn_index, inFormat=a=>input, outFormat=a=>a}, runManager){
        const hash={session_hash:session, fn_index}
        const inputData=await inFormat(...arguments)
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
                    default://"estimation","process_generating","process_starts"
                        break;
                }
            }
        })
        return await outFormat({...arguments[0],output:data}, runManager)
    }
}


Node.services={
    Text2Image:{
        label:"Text2Image",
        name:"Text2Image",
        description:"generate image from text",
        url: "wss://runwayml-stable-diffusion-v1-5.hf.space/queue/join",
        fn_index:1,
        async outFormat({output,qili}){
            const images=output[0], now=Date.now()
            const urls=await Promise.all(
                images[0].map((image,i)=>{
                    return qili.upload({uri:image, key:`_temp_/1/${now}/${i}`})
                })
            )
            return urls.join(",")
        }
    }
}

module.exports={nodeClass:Node}