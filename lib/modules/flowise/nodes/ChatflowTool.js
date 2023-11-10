const { DynamicTool } =require( 'langchain/tools')
const { getBaseClasses }=require("flowise-components/dist/src/utils")
const { constructGraphs, getEndingNode } = require('flowise/dist/utils')
class ChatflowToolNode{
    constructor(){
        this.label = 'Chatflow Tool'
        this.name = 'chatflowTool'
        this.type = 'ChatflowTool'
        this.category = "Tools"
        this.version = "1.0"
        this.icon = `${__dirname}/chatflow-tool.svg`
        this.description = `Use chatflow you've created in Flowise`
        this.baseClasses = [this.type, ...getBaseClasses(ChatflowTool)]
        this.inputs = [
            {
                label: 'Select Chatflow',
                name: 'selectedChatflow',
                type: 'asyncOptions',
                loadMethod: 'listChatflows'
            },
            {
                label: 'Tool Description',
                name: 'description',
                type: 'string',
                rows: 3,
                placeholder:'A description for this chatflow'
            },
        ]

        this.loadMethods = {
            async listChatflows(nodeData, {appDataSource, databaseEntities}){
                const chatflows=await appDataSource.getRepository(databaseEntities['ChatFlow']).find()
                return chatflows.map(({name, id, description})=>({label:name, name:id, description}))
            }
        }
    }

    async init({inputs:{selectedChatflow, description, patch, preTool, ...anchorsPatch}}, _, {appDataSource, databaseEntities, }){
        const chatflow = await appDataSource.getRepository(databaseEntities['ChatFlow']).findOneBy({
            id: selectedChatflow
        })

        return new ChatflowTool({
            name:chatflow.name,
            description: description||chatflow.description, 
            schema: chatflow.schema,
            chatflowId: selectedChatflow,
            patch,
            anchorsPatch,
            returnDirect:true,
        })
    }
}

class ChatflowTool extends DynamicTool{
    constructor({chatflowId,patch={},anchorsPatch, ...rest}){
        super({
            ...rest,
            async func(question, runManager){
                debugger
                const result=await runManager.metadata.predict(chatflowId, {question, overrideConfig:patch}, runManager.runId)
                return result
            }
        })
    }
}

module.exports={nodeClass:ChatflowToolNode}