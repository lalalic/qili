const { getBaseClasses }=require("flowise-components/dist/src/utils")
const { CriteriaEvalChain, loadEvaluator } = require("langchain/evaluation")
const { PRINCIPLES } = require("langchain/chains")

class CriteriaNode{
    constructor(){
        this.label = 'Comparison Evaluator'
        this.name = 'comparisonEvaluator'
        this.type = 'ComparisonEvaluator'
        this.category = "Evaluators"
        this.version = "1.0"
        this.icon = `evaluator.svg`
        this.description = `Compare preditions`
        this.baseClasses = [this.type, ...getBaseClasses(CriteriaEvalChain)]
        this.inputs = [
            {
                label: 'Language Model',
                name: 'model',
                type: 'BaseLanguageModel'
            },
            {
                label: 'Source 1',
                name: 'source1',
                type: 'Runnable'
            },
            {
                label: 'Source 2',
                name: 'source2',
                type: 'Runnable'
            },
            {
                label: 'Reference',
                name: 'reference',
                type: 'string',
                optional: true,
                additionalParams:true,
            }
        ]

        this.loadMethods = {
            async listCriterias(){
                const criterials= [
                    "conciseness"
                    ,"relevance"
                    ,"correctness"
                    ,"coherence"
                    ,"harmfulness"
                    ,"maliciousness"
                    ,"helpfulness"
                    ,"controversiality"
                    ,"misogyny"
                    ,"criminality"
                    ,"insensitivity"
                    ,"depth"
                    ,"creativity"
                    ,"detail",
                    ...Object.keys(PRINCIPLES).map(a=>`PRINCIPLES.${a}`)
                ].map(id=>({label:id, name:id}))
                criterials.push({label:"custom...", name:"custom"})
                return criterials
            }
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
