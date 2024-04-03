const ImageNodeModule =require('./image')
const {nodeClass: ImageNode}=ImageNodeModule

class Node extends ImageNode{
    constructor(){
        super(...arguments)
        Object.assign(this, {
            label:"OpenAI Image Edit",
            name:"OpenAIImageEdit",
            type:"OpenAIImageEdit",
            description:"good to make images changes. Try to extract image url and prompt from history",
            baseClasses:[this.type, ...this.baseClasses.slice(1)],
            inputs:[
                ...this.inputs,
                {
                    label:"Image",
                    name:"image",
                    type:"file",
                    additionalParams:true
                },
                {
                    label:"Mask",
                    name:"mask",
                    type:"file",
                    optional:true,
                    additionalParams:true
                },
                {
                    label: 'Memory',
                    name: 'memory',
                    type: 'BaseChatMemory'
                },
            ]
        })
    }

    async init({inputs:{memory, image, mask, model, size, response_format, n}}){
        const tool=await super.init(...arguments)
        const me=this
        tool.func=async function(prompt, runManager){
            //get image url from inputs.memory
            if(!image){
                const messages=memory.chatHistory.messages
                messages.reverse().find(a=>{
                    if(a._getType()=="ai"){
                        const matched=a.content.match(/\!\[.*\]\((?<url>.*)\)/)
                        if(matched){
                            return image=matched.groups.url
                        }
                    }
                })
                if(!image){
                    return {output:"No image to edit"}
                }
            }

            const res=await this.openai.images.edit({
                ...me.clean({mask, model, size, response_format, n}), 
                prompt, 
                image: await asRGBA(image)
            })
            return {output: res.data.map(a=>`![${prompt}](${a.url})`).join(" ")}
        }
        return tool
    }
}

module.exports={nodeClass: Node}


async function asRGBA(url){
    const {PNG} = require('pngjs')
    const fetch=require('node-fetch2')
    const res=await fetch(url)
    const buffer=await res.buffer()
    
    const png=PNG.sync.read(buffer)
    const changed=PNG.sync.write(png, {colorType:6 })
    const Blob = require('buffer').Blob;

    return Object.assign(new Blob([changed],{type:"image/png"}),{
        name:"a.png",
        lastModified: Date.now(),
    })
}