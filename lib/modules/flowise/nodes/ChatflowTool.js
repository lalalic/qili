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

    async init({inputs:{selectedChatflow, description, patch, preTool, ...anchorsPatch}}, _, {appDataSource, databaseEntities}){
        const chatflow = await appDataSource.getRepository(databaseEntities['ChatFlow']).findOneBy({
            id: selectedChatflow
        })

        if (!chatflow) throw new Error(`ChatFlow[${selectedChatflow}] not found`)
        
        return new ChatflowTool({
            name:chatflow.name,
            description: description||chatflow.description, 
            schema: chatflow.schema,
            chatflow,
            patch,
            anchorsPatch,
        })
    }
}

class ChatflowTool extends DynamicTool{
    constructor({chatflow,patch={},anchorsPatch, ...rest}){
        super({
            ...rest,
            async func(input, runManager){
                // const {nodes, edges}=JSON.parse(chatflow.flowData)
                // Object.keys(patch).forEach(nodeId=>{
                //     const node=nodes.find(a=>a.id==nodeId)
                //     node.inputs={...node.inputs, ...patch[nodeId]}
                // })

                // const { graph, nodeDependencies } = constructGraphs(nodes, edges)
                // const directedGraph = graph
                // const endingNodeId = getEndingNode(nodeDependencies, directedGraph)

                // const constructedObj = constructGraphs(nodes, edges, true)
                // const nonDirectedGraph = constructedObj.graph
                // const { startingNodeIds, depthQueue } = getStartingNodes(nonDirectedGraph, endingNodeId)
                // const nodeToExecute = reactFlowNodes.find((node) => node.id === endingNodeId)

                // Object.keys(anchorsPatch).forEach(key=>{
                //     if(anchorsPatch[key]){
                //         nodeToExecute.inputs[key]=anchorsPatch[key]
                //     }
                // })

                // const reactFlowNodeData: INodeData = resolveVariables(
                //     nodeToExecute.data,
                //     reactFlowNodes,
                //     incomingInput.question,
                //     incomingInput.history
                // )
                // nodeToExecuteData = reactFlowNodeData
                

                // logger.debug(`[server]: Start building chatflow ${chatflowid}`)
                // /*** BFS to traverse from Starting Nodes to Ending Node ***/
                // const reactFlowNodes = await buildLangchain(
                //     startingNodeIds,
                //     nodes,
                //     graph,
                //     depthQueue,
                //     this.nodesPool.componentNodes,
                //     incomingInput.question,
                //     incomingInput.history,
                //     chatId,
                //     chatflowid,
                //     this.AppDataSource,
                //     incomingInput?.overrideConfig,
                //     this.cachePool
                // )

                const ret=chatflow.run(input, runManager?.getChild())
                return ret.message
            }
        })
    }
}

module.exports={nodeClass:ChatflowToolNode}