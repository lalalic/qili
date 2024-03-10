const openAICost = require('openai-cost-calculator');
const openaiTokenCounter = require('openai-gpt-token-counter');
debugger
module.exports={
    nodes:{
        customTool(run, qili, user){
            const {node:{inputs:{selectedTool}}}=run
            const tool=qili.get1Entity("Tool",{_id:selectedTool, author:{$ne: user._id}}, {_id:1, author:1, price:1})
            if(tool){
                tool.type="Tool"
            }
            return tool
        },
        chatflowTool(run,qili, user){
            const {node:{inputs:{selectedChatflow}}}=run
            return qili.get1Entity("Chatflow",{_id:selectedChatflow, author:{$ne: user._id}}, {_id:1, author:1, price:1})
        }, 
        qiliRoot(run, qili, user){
            return qili.get1Entity("Chatflow",{_id:run.chatflow, author:{$ne: user._id}}, {_id:1, author:1, price:1})
        }
    },
    credentials:{
        openAIApi(run){
            let {model="gpt-3.5-turbo",input, output, stream, prompt_tokens:promptTokens=0, completion_tokens:completionTokens=0}=run
            if(stream){
                const inputText=JSON.stringify(input)
                const outputText=JSON.stringify(output)

                promptTokens=openaiTokenCounter.text(inputText, model)
                completionTokens=openaiTokenCounter.text(outputText, model)
            }
            const cost=openAICost.calculateLanguageModelCost(model,{promptTokens,completionTokens}).totalCost*100*1000
            return Math.ceil(cost)
        },
        aliApi(run){
            const {node, model=node?.inputs?.modelName, prompt_tokens=0, completion_tokens=0}=run
            return Math.max(100,(ali[model]||ali["qwen-turbo"])*(prompt_tokens+completion_tokens))
        },
        baiduApi(run){
            return 100
        },
        serpApi(run){
            return 100
        },
        serperApi(run){
            return 100
        }
    }
}

const ali={
    "qwen-turbo":1,
}
