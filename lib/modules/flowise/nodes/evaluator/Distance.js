const { getBaseClasses }=require("flowise-components/dist/src/utils")
const { CriteriaEvalChain, loadEvaluator } = require("langchain/evaluation")
const { PRINCIPLES } = require("langchain/chains")

class DistanceNode{
    constructor(){
        this.label = 'Distance Evaluator'
        this.name = 'distanceEvaluator'
        this.type = 'DistanceEvaluator'
        this.category = "Evaluators"
        this.version = "1.0"
        this.icon = `evaluator.svg`
        this.description = `Evaluate output distance to reference by criteria`
        this.baseClasses = [this.type, ...getBaseClasses(CriteriaEvalChain)]
        this.inputs = [
            {
                label: 'Distance Metric',
                name: 'distanceMetric',
                type: 'asyncOptions',
                loadMethod: 'listDistanceMetrics'
            },
            {
                label: 'Language Model',
                name: 'model',
                type: 'BaseLanguageModel'
            },
            {
                label: 'Embedding',
                name: 'embedding',
                type: 'Embedding',
            }

        ]

        this.loadMethods = {
            async listDistanceMetrics(){
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

    async init({inputs:{embedding, reference}}){
        const evaluator=loadEvaluator("embedding_distance", {embedding})
        evaluator.evaluate=async function(test, ...args){
            test={...test}
            if(reference){
                test.reference=reference
            }
            return await this.evaluateStrings(test, ...args)
        }
        return evaluator
    }
}

module.exports = { nodeClass: DistanceNode }
