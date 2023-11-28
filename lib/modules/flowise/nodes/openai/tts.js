const ImageNodeModule =require('./image')
const {nodeClass: ImageNode}=ImageNodeModule

class Node extends ImageNode{
    constructor(){
        super(...arguments)
        Object.assign(this, {
            label:"Text To Speech",
            name:"openaiTTS",
            type:"OpenaiTTS",
            baseClasses:[this.type, ...this.baseClasses.slice(1)],
            inputs:[
                {
                    label:"Model",
                    name:"model",
                    type:"options",
                    options: "tts-1,tts-1-hd".split(",").map(a=>({label:a, name:a.trim()})),
                    default: 'tts-1',
                },
                {
                    label:"Voice",
                    name:"voice",
                    type:"options",
                    additionalParams:true,
                    options:"alloy, echo, fable, onyx, nova, shimmer".split(",").map(a=>({label:a, name:a.trim()})),
                    default:"alloy",
                },
                {
                    label:"Format",
                    name:"response_format",
                    type:"options",
                    default:"mp3",
                    additionalParams:true,
                    options:"mp3,opus,aac,flac".split(",").map(a=>({label:a, name:a.trim()}))
                },
                {
                    label:"Speed",
                    name:"speed",
                    type:"number",
                    additionalParams:true,
                    default: 1
                },
            ]
        })
    }

    async init({inputs}, _, options, qili, flowise){
        const tool=await super.init(...arguments)
        const me=this
        tool.func=async function(input, runManager){
            const res=await this.openai.audio.speech.create({...me.clean(inputs), input})
            const buffer = Buffer.from(await res.arrayBuffer());
            const url=await qili.upload({
                    uri:`data:audio/mp3;base64,${buffer.toString("base64")}`, 
                    key:`_temp_/1/${require('uuid').v4()}`
                }, 
                runManager?.metadata?.author||'system'
            )
            return {output:`[${input}](#audio?url=${url})`}
        }
        return tool
    }
}

module.exports={nodeClass: Node}