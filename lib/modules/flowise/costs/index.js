module.exports={
    nodes:{
        
    },
    credentials:{
        openAIApi(run){
            if(!run.tokensUsage)
                return 0
            const prices=require("./openai")
            let {model,stream, tokensUsage:{prompt:promptTokens=0, completion:completionTokens=0}}=run
            if(stream || (promptTokens+completionTokens)==0){
                const {input, output}=run
                const inputText=JSON.stringify(input)
                const outputText=JSON.stringify(output)
                const openaiTokenCounter = require('openai-gpt-token-counter');
                promptTokens=openaiTokenCounter.text(inputText, model)
                completionTokens=openaiTokenCounter.text(outputText, model)
            }
            const price=prices.LanguageModels[model]
            return (price.Input*promptTokens+price.Output*completionTokens)*100
        },
        aliApi(run){
            if(!run.tokensUsage)
                return 0
            const ali = require("./ali")
            const {node, model=node?.inputs?.modelName, tokensUsage:{prompt:promptTokens=0, completion:completionTokens=0, image_tokens=0}}=run
            const tokens=promptTokens+completionTokens+image_tokens
            return tokens*ali[model]/7*100
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
