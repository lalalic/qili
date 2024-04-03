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
            if(input.startsWith("data:")){
                const text=await this.openai.audio.transcriptions.create({
                    ...me.clean(inputs), 
                    model:"whisper-1",
                    file: me.asUploadable(input)
                })
                return text
            }else if(input.indexOf("#audio?url=")!=-1){
                const {url, file}=await extractFromMarkdown(input)
                const text=await this.openai.audio.transcriptions.create({
                    ...me.clean(inputs), 
                    model:"whisper-1",
                    file
                })
                return `[${text}](#audio?url=${url})`
            }else{
                return input
            }
        }
        return tool
    }

    async request(audio, apiKey){
        const OpenAI =require('openai')
        const openai=new OpenAI({apiKey})
        const res=await openai.audio.transcriptions.create({
            model:"whisper-1",
            file: await fetch(audio)
        })
        return res.text
    }
}

async function extractFromMarkdown(input){
    const matched=input.match(/\[.*\]\(#audio\?url=(?<url>.*)\)/)
    const url=matched.groups.url
    const fetch=require('node-fetch')
    const res=await fetch(url)
    return {file:res, url}
}

module.exports={nodeClass: Node}