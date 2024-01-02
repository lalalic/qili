const { DynamicTool } =require( 'langchain/tools')
const { getBaseClasses }=require("flowise-components/dist/src/utils")
class ChatflowToolNode{
    constructor(){
        this.label = 'Chatflow Tool'
        this.name = 'chatflowTool'
        this.type = 'ChatflowTool'
        this.category = "Tools"
        this.version = "1.0"
        this.icon = `chatflow-tool.svg`
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

    async init({inputs:{selectedChatflow, description, patch}, id}, _, options, qili, flowise){
        const {appDataSource, databaseEntities}=options
        const chatflow = await appDataSource.getRepository(databaseEntities['ChatFlow']).findOneBy({
            id: selectedChatflow
        })
        const ctx=flowise.extractRunMetadata(options)
        return new DynamicTool({
            name:chatflow.name,
            description: description||chatflow.description, 
            returnDirect:true,
            chatflowId: selectedChatflow, nodeId:id, patch,//@TODO: remove it
            async func(question, runManager){
                const result=await ctx.predict(selectedChatflow, id, {question, overrideConfig:patch}, runManager.runId)
                return result
            }
        })
    }
}

/**
 * @Todo: remove it
 */
class ChatflowTool extends DynamicTool{
    constructor({chatflowId,patch={},nodeId, ...rest}){
        super({
            ...rest,
            async func(question, runManager){
                /**
                 * how to override anchors
                 * 1. extract the graph end at this node
                 * 2. override chatflow's graph with #1
                 * 3. doesn't support array anchors
                 */
                patch={...patch, overrideEndingNodeAnchorsGraph:runManager.metadata.extractNodeGraph(nodeId)}
                const result=await runManager.metadata.predict(chatflowId, {question, overrideConfig:patch}, runManager.runId)
                return result
            }
        })
    }
}

module.exports={nodeClass:ChatflowToolNode}