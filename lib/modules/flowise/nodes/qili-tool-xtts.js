const { DynamicTool} = require('langchain/tools')
const QiliTool=require('./qili-tools')
const fetch=require('node-fetch2')

class Node extends QiliTool.nodeClass{
    constructor(){
        super(...arguments)
        Object.assign(this,{
            name:"xtts",
            label:"TTS with sample",
            description:"Clone sample voices to generate speech from text",
            type:"XTTS",
            inputs:[
                {
                    label: 'Sample',
                    name: 'sample',
                    type: 'file',
                    fileType:'.wav, .xtts',
                    description:"voice sample"
                },
                {
                    label: 'Language',
                    name: 'language',
                    type: 'options',
                    default: 'en',
                    options:"zh-cn,en,fr,ja,de".split(",").map(a=>({label:a, name:a.trim()}))
                },
            ]
        })
        this.baseClasses=[this.type, ...this.baseClasses.slice(1)]
    }

    async init({inputs:{sample,language}}){
        const me=this
        const tool= new DynamicTool({
            name:this.name, 
            description:this.description,
            returnDirect:true,
            async func(input, runManager){
                const domain="coqui-xtts.hf.space"
                const response = await fetch(sample)
                const buffer = await response.buffer()
                const sampleData=`data:audio/wav;base64,${buffer.toString('base64')}`

                async function tts1(sentence){
                    const {output}=await me.send({
                        url:`wss://${domain}/queue/join`,
                        fn_index:1,
                        input: [
                            sentence, 
                            language, 
                            {data:sampleData, name:"a.wav"},
                            null,false,false,false, true
                        ],
                    }, runManager)
                    return output[1]?.name
                }

                const filePaths=await Promise.all(
                    (input.length<200 ? [input] : input.split(/[\n+.]/))
                        .filter(a=>!!a)
                        .map(tts1)
                )
                const url=filePaths.filter(a=>!!a)
                    .map(filePath=>encodeURIComponent(`https://${domain}/file=${filePath}`))
                    .map(url=>`url=${url}`)
                    .join("&")

                return url ? `[${input}](#audio?${url})` : input
            }
        })

        return tool
    }
}

module.exports={nodeClass:Node}