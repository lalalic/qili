const ImageNodeModule =require('./image')
const {nodeClass: ImageNode}=ImageNodeModule

class Node extends ImageNode{
    constructor(){
        super(...arguments)
        Object.assign(this, {
            label:"Vision",
            name:"openaiVision",
            type:"OpenaiVision",
            description:"good to describe an image. The input must be one or more url with , seperated.",
            baseClasses:[this.type, ...this.baseClasses.slice(1)],
            inputs:[
                {
                    label:"Image",
                    name:"image",
                    type:"file",
                    additionalParams:true,
                    optional:true,
                }
            ]
        })
    }

    async init({inputs:{image, prompt}}){
        const tool=await super.init(...arguments)
        tool.func=async function(input, runManager){
            input=input||image
            const res=await this.openai.chat.completions.create({
                model: "gpt-4-vision-preview",
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        ...(
                            input.split(",").map(url=>({
                                type: "image_url",
                                image_url: {
                                    url
                                },
                            }))
                        )
                    ],
                }],
            })
            
            return res.choices[0]
        }
        return tool
    }
}

module.exports={nodeClass: Node}