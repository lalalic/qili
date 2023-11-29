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
                }
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
                const url="wss://coqui-xtts-streaming.hf.space/queue/join"
                const response = await fetch(sample)
                const buffer = await response.buffer();
                const sampleData=`data:image/*;base64,${buffer.toString('base64')}`
                const output=me.send({
                    url,
                    fn_index:1,
                    input: [input, language, {data:sampleData},false, , true, true],
                }, runManager)
                const filePath=output[0]?.[0]?.name
                return `[${input}](#audio?url=${encodeURIComponent(`https://coqui-xtts-streaming.hf.space/file=${filePath}`)}`
            }
        })

        return tool
    }
}

module.exports={nodeClass:Node}