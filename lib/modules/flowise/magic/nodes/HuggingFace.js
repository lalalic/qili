const monkeyIntercept=require('../monkey-intercept')

module.exports=function extend(node){
    const HuggingFaceToolNode=node.constructor
    Object.assign(HuggingFaceToolNode.services,{
        ImagePromptEx:{
            label:"Enhance Prompt",
            name:"ImagePromptEx",
            description:"enhance image prompt",
            url: "wss://gustavosta-magicprompt-stable-diffusion.hf.space/queue/join",
            fn_index:0,
            outFormat({data}){
                const prompts=data[0]
                return prompts.split("\n").find(a=>a.trim().length>0)
            }
        },
        Text2Image:{
            label:"Text2Image",
            name:"Text2Image",
            description:"generate image from text",
            url: "wss://runwayml-stable-diffusion-v1-5.hf.space/queue/join",
            fn_index:1,
            async outFormat({data,tool,input}){
                const images=data[0], now=Date.now()
                const urls=await Promise.all(
                    images.map((image,i)=>{
                        return tool.qili.upload({uri:image, key:`$temp/1/${now}/${i}`})
                    })
                )
                return urls.map(src=>`![image](https://ai.qili2.com${src})`).join(",")
            }
        },
        Image2Tag:{
            name:"Image2Tag",
            label:"Image2Tag",
            description:"recognize object in image",
            url:"wss://xinyu1205-recognize-anything.hf.space/queue/join",
            fn_index:2,
        },
        Image2Chat:{
            name:"Image2Chat",
            label:"Image2Chat",
            description:"chat about an image",
            url:"wss://badayvedat-llava.hf.space/queue/join",
            fn_indexes:[9,10],
            async inFormat({input,tool,i=0, session}){
                switch(i){
                    case 0:
                        return !session ? [,"",input,'Default'] : [,input,,'Default']
                    case 1:
                        return [,"llava-v1.5-13b-4bit",0.5,0.7,512]
                }
            },
            async outFormat({data, tool,i=0, session}){
                switch(i){
                    case 0:
                        return session
                    case 1:
                        return data[1]?.[0]?.reverse().find(a=>!!a)||""
                }
            }
        },
        VoiceGenerator:{
            name:"VoiceGenerator",
            label:"VoiceGenerator",
            description:"generate voice with text and wav",
            url: "wss://coqui-xtts-streaming.hf.space/queue/join",
            fn_index:1,
            inFormat({input,sample}){
                return [input, "en", {data:sample},false, , true, true]
            },
            outFormat({data}){
                const filePath=data[0]?.[0]?.name
                if(filePath){
                    return `https://coqui-xtts-streaming.hf.space/file=${filePath}`
                }else{
                    return "Wrong"
                }
            }
        }
    })
    node.inputs[0].options=Object.values(HuggingFaceToolNode.services)
}