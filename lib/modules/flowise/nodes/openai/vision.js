const ImageNodeModule =require('./image')
const {nodeClass: ImageNode}=ImageNodeModule

class Node extends ImageNode{
    constructor(){
        super(...arguments)
        Object.assign(this, {
            label:"Vision",
            name:"openaiVision",
            type:"OpenaiVision",
            baseClasses:[this.type, ...this.baseClasses.slice(1)],
            inputs:[
                ...this.inputs,
                {
                    label:"Image",
                    name:"image",
                    type:"file",
                },
                {
                    label: 'Prompt',
                    name: 'prompt',
                    type: 'BasePromptTemplate'
                },
            ]
        })
    }

    async init({inputs:{image, prompt}}){
        const tool=await super.init(...arguments)
        tool.func=async function(input, runManager){
            const res=await this.openai.chat.completions.create({
                model: "gpt-4-vision-preview",
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url:image
                            },
                        },
                    ],
                }],
            })
            
            return res.choices[0]
        }
        return tool
    }
}

module.exports={nodeClass: Node}