const { constructGraphs, getEndingNode}=require("flowise/dist/utils")
class ChatFlow{
    constructor(data){
        const {nodes, edges}=JSON.parse(data)
        const {graph, nodeDependencies} = constructGraphs(nodes, edges)
        this.graph=graph
        this.nodeDependencies=nodeDependencies
        this.endingNode=getEndingNode(nodeDependencies, graph)
    }

    isRunnable(){
        return ["Chain", "Agent"].indexOf(this.endingNode.category)!=-1
    }

    
}

/**
 * const chatflow=new ChatFlow(data)
 * const endingNode=chatflow.getEndingNode()
 * if(chatflow.isChain || chatflow.isAgent){
 *  //can be 
 * }
 */