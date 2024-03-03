const uuid = require('uuid')
function isDataURI(data){
    return data?.startsWith?.("data:")
}

module.exports=function extend(node){
    const HuggingFaceToolNode=node.constructor
    Object.assign(HuggingFaceToolNode.services,{
        ImagePromptEx:{
            label:"Enhance Prompt",
            name:"ImagePromptEx",
            description:"enhance image prompt",
            url: "wss://gustavosta-magicprompt-stable-diffusion.hf.space/queue/join",
            fn_index:0,
            outFormat({output}){
                const prompts=output[0]
                return prompts.split("\n").find(a=>a.trim().length>0)
            }
        },
        Text2Image:{
            label:"Text2Image",
            name:"Text2Image",
            description:"generate image from text",
            url: "wss://runwayml-stable-diffusion-v1-5.hf.space/queue/join",
            fn_index:1,
            async inFormat({input}){
                return [input]
            },
            async outFormat({output,qili, author}){
                const images=output[0], now=uuid.v4()

                const urls=await Promise.all(
                    images.slice(0,1).map((image,i)=>{
                        return qili.upload({uri:image, key:`_temp_/1/${now}/${i}`}, author)
                    })
                )
                return urls.map(src=>`![image](${src})`).join("")
            }
        },
        Image2Tag:{
            name:"Image2Tag",
            label:"Image2Tag",
            description:"it's good to simply recognize object in image without description. the input must be a url.",
            url:"wss://xinyu1205-recognize-anything.hf.space/queue/join",
            fn_index:2,
            async inFormat({input}){
                if(!isDataURI(input)){
                    throw new Error(`need image file url`)
                }
                return [input]
            }
        },
        TTS:{
            label:"Text to Speech",
            name:"TTS",
            description:"Speech Synthesis, convert text to speech",
            url: "wss://matthijs-speecht5-tts-demo.hf.space/queue/join",
            fn_index:0,
            async inFormat({input}){
                return [input,"CLB (female)"]
            },
            async outFormat({input, output:[{is_file, name}]}){
                return `[${input}](#audio?url=${encodeURIComponent(`https://matthijs-speecht5-tts-demo.hf.space/file=${name}`)})`
            }
        }
    })
    node.inputs[0].options=Object.values(HuggingFaceToolNode.services)
}