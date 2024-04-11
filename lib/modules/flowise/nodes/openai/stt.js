const ImageNodeModule =require('./image')
const {nodeClass: ImageNode}=ImageNodeModule

class Node extends ImageNode{
    constructor(){
        super(...arguments)
        Object.assign(this, {
            label:"OpenAI Speech To Text",
            name:"OpenAISTT",
            type:"OpenAISTT",
            description:"Speech to Text with openAI module",
            baseClasses:[this.type, ...this.baseClasses.slice(1)],
            inputs:[
                {
                    label:"Instruction",
                    name:"prompt",
                    type:"string",
                    additionalParams:true,
                    optional:true,
                },
                {
                    label:"Format",
                    name:"response_format",
                    type:"options",
                    default:"text",
                    additionalParams:true,
                    optional:true,
                    options:"text,srt,vtt,json,verbose_json".split(",").map(a=>({label:a, name:a.trim()}))
                },
                {
                    label:"Temperature",
                    name:"temperature",
                    type:"number",
                    additionalParams:true,
                    default: 0,
                    optional:true
                },
            ]
        })
    }

    async init({inputs}){
        const tool=await super.init(...arguments)
        const me=this
        tool.func=async function(input, runManager){
            inputs=Object.keys(inputs).reduce((values, key)=>{
                if(inputs[key]!==""){
                    values[key]=inputs[key]
                }
                return values
            },{})
            const text=await this.openai.audio.transcriptions.create({
                ...me.clean(inputs), 
                model:"whisper-1",
                file: await fetch(input)
            })
            return text
        }
        return tool
    }
}


module.exports={nodeClass: Node}