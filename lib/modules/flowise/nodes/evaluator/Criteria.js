const { getBaseClasses }=require("flowise-components/dist/src/utils")
const { CriteriaEvalChain, loadEvaluator } = require("langchain/evaluation")
const { PRINCIPLES } = require("langchain/chains")

class CriteriaNode{
    constructor(){
        this.label = 'Criteria Evaluator'
        this.name = 'criteriaEvaluator'
        this.type = 'CriteriaEvaluator'
        this.category = "Evaluators"
        this.version = "1.0"
        this.icon = `evaluator.svg`
        this.description = `Evaluate output by criteria`
        this.baseClasses = [this.type, ...getBaseClasses(CriteriaEvalChain)]
        this.inputs = [
            {
                label: 'Enabled',
                name: 'enabled',
                type: 'boolean',
                default:true
            },
            {
                label: 'Evaluate',
                name: 'shouldEvaluate',
                type: 'boolean',
                default:true
            },
            {
                label:"name",
                name:'testCaseName',
                type: 'string',
                optional: true,
            },
            {
                label: 'Criteria',
                name: 'criteria',
                type: 'asyncOptions',
                loadMethod: 'listCriterias'
            },
            {
                label: 'Language Model',
                name: 'model',
                type: 'BaseLanguageModel'
            },
            {
                label: 'question',
                name: 'input',
                type: 'string',
                rows:2,
            },
            {
                label: 'override config',
                name: 'overrideConfig',
                type: 'string',
                rows: 4,
                description:'json: {"switchTTS":"OpenAITTS"}',
                optional: true,
                additionalParams:true,
            },
            {
                label: 'history',
                name: 'history',
                type: 'string',
                description:'json history array: [{"type":"userMessage", "message":},{"type":"apiMessage"}]',
                rows: 4, 
                optional: true,
                additionalParams:true,
            },
            {
                label: 'Reference',
                name: 'reference',
                type: 'string',
                optional: true,
                additionalParams:true,
            },
            {
                label: 'custom criteria',
                name: 'custom',
                type: 'json',
                optional: true,
                additionalParams:true,
            },
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
                criterials.push({label:"==", name:"eq"})
                criterials.push({label:"custom...", name:"custom"})
                return criterials
            }
        }
    }

    async init({inputs:{criteria, model, reference, custom}}){
        if(criteria=="custom" && custom && Object.keys(custom).length>0){
            criteria=custom
        }else if(criteria.startsWith("PRINCIPLES")){
            const key=criteria.split(".")[1]
            if(key in criteria.split()){
                criteria=PRINCIPLES[key]
            }
        }
        const evaluator=await loadEvaluator(reference ? "labeled_criteria" : "criteria", {llm:model,criteria})
        evaluator.evaluate=async function(test, ...args){
            test={...test}
            if(reference){
                test.reference=reference
            }
            if(criteria=="eq"){
                if(test.prediction == reference){
                    return Promise.resolve({
                        value:"Y",
                        score:100,
                        reasoning: `prediction == reference`,
                    })
                }else{
                    return Promise.resolve({
                        value:"N",
                        score:0,
                        reasoning: `prediction != reference`,
                    })
                }
            }
            if(!model)
                throw new Error('No model specified on Evaluator')
        
            const result= await this.evaluateStrings(test, ...args)
            result.criteria=criteria
            if(reference){
                result.reference=reference
            }
            return result
        }

        return evaluator
    }
}

module.exports = { nodeClass: CriteriaNode }
