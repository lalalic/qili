const monkeyIntercept=require('../monkey-intercept')

module.exports={
    huggingFace:require("./HuggingFace"),
    openAIFunctionAgent(node){
        node.inputs.splice(node.inputs.length,0,
            {
                label:"Test Tool",
                name:"tool",
                type:"string",
                description:"Direct return action without prediction",
                optional:true,
                additionalParams:true,
            },
            {
                label:"Test Input",
                name:"input",
                type:"string",
                description:"Input for selected tool",
                optional:true,
                additionalParams:true
            },
            {
                label:"Test",
                name:"enableTest",
                type:"boolean",
                description:"enable to use tool+input for test",
                optional:true,
            },
        );

        monkeyIntercept(node.constructor.prototype, 'init', init=>async function(nodeData){
            const executor=await init.call(this, ...arguments)
            if(nodeData.inputs?.tool && nodeData.inputs.enableTest){
                const {tool, input}=nodeData.inputs
                executor.agent.plan=(plan=>async function(){
                    return {
                        tool,
                        toolInput:{input},
                        log:`Invoking "${tool}" with "${input}"`
                    }
                })(executor.agent.plan);
            }
            return executor
        },'testable')
    },
}