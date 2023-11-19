const { getBaseClasses }=require("flowise-components/dist/src/utils")
const { CriteriaEvalChain, loadEvaluator } = require("langchain/evaluation")
const { PRINCIPLES } = require("langchain/chains")

class CriteriaNode{
    constructor(){
        this.label = 'Agent Evaluator'
        this.name = 'agentEvaluator'
        this.type = 'AgentEvaluator'
        this.category = "Evaluators"
        this.version = "1.0"
        this.icon = `evaluator.svg`
        this.description = `Evaluate agent tracjectory`
        this.baseClasses = [this.type, ...getBaseClasses(CriteriaEvalChain)]
        this.inputs = [
            {
                label: 'Language Model',
                name: 'model',
                type: 'Agent'
            }
        ]

        this.loadMethods = {
            
        }
    }

    async init({inputs:{criteria, model, reference, custom}}, _, {appDataSource, databaseEntities}){
        if(criteria=="custom" && custom && Object.keys(custom).length>0){
            criteria=custom
        }else if(criteria.startsWith("PRINCIPLES")){
            const key=criteria.split(".")[1]
            if(key in criteria.split()){
                criteria=PRINCIPLES[key]
            }
        }
        const evaluator=loadEvaluator(reference ? "labeled_criteria" : "criteria", {llm:model,criteria})
        evaluator.evaluate=async function(test){
            test={...test}
            if(reference){
                test.reference=reference
            }
            return await this.evaluateStrings(test)
        }
        return evaluator
    }
}

module.exports = { nodeClass: CriteriaNode }
