const { encodingForModel } = require("js-tiktoken")

const modelEncodings={}
function getEncodingForModel(model){
    return modelEncodings.model=modelEncodings.model||encodingForModel(model)
}

module.exports=async function(run){
    const {
        model,
        input,
        output,
        completion_tokens=getEncodingForModel(model).encode(output),
        prompt_tokens=getEncodingForModel(model).encode(input),
    }=run
    if(completion_tokens || prompt_tokens){
        return completion_tokens+prompt_tokens
    }
}

const Models={
    ["gpt-3.5-turbo"](tokens){
        return 1
    }
}