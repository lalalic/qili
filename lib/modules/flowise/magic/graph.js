const { replaceInputsWithConfig, resolveVariables, databaseEntities}=require("flowise/dist/utils")
const logger=require("flowise/dist/utils/logger").default

exports.asDirectGraph=function(graph, endNodeId){
    const directedGraph=Object.keys(graph).reduce((all,key)=>{
        all[key]=[...graph[key]]
        return all
    },{})
    
    const removeTarget=(current)=>{
        //first remove all sliblings, then go deep to avoid dead loop
        directedGraph[current].forEach(next=>{
            const i=directedGraph[next].indexOf(current)
            if(i!=-1){
                directedGraph[next].splice(i,1)
            }
        })

        directedGraph[current].forEach(next=>{
            removeTarget(next)
        })
    }

    removeTarget(endNodeId)

    return directedGraph
}

exports.getStartingNodes=function(graph, endNodeId){
    const directedGraph=exports.asDirectGraph(graph, endNodeId)

    const startingNodeIds=Object.keys(directedGraph).filter(nodeId=>directedGraph[nodeId].length==0)
    const depthQueue={[endNodeId]:0}
    const depth=(current,d)=>{
        //first depth all, then go deep for multiple links
        directedGraph[current].forEach(nodeId=>{
            depthQueue[nodeId]=d+1
        })

        directedGraph[current].forEach(nodeId=>{
            depth(nodeId, d+1)
        })
    }
    depth(endNodeId,0)

    const maxDepth=Math.max(...Object.values(depthQueue))
    const depthQueueReversed=Object.keys(depthQueue).reduce((reversed, key)=>{
        reversed[key]=maxDepth-depthQueue[key]
        return reversed
    },{})
    startingNodeIds.sort((a,b)=>depthQueueReversed[a]-depthQueueReversed[b])
    return {startingNodeIds, depthQueue: depthQueueReversed}
}

/**
 * build from low depth to high
 */
exports.buildLangchain=async function(startingNodeIds, reactFlowNodes, graph, depthQueue, componentNodes, question, chatHistory, chatId, chatflowid, appDataSource, overrideConfig, cachePool){
    const maxDepth=Math.max(...Object.values(depthQueue))
    const nodesInDepth=new Array(maxDepth+1).fill(0)
    nodesInDepth.forEach((_,level)=>{
        nodesInDepth[level]=Object.keys(depthQueue).filter(k=>depthQueue[k]==level)
    })

    for(let i=0;i<maxDepth+1; i++){//depth from 0 to n
        const nodes=nodesInDepth[i]
        for(let k=0; k<nodes.length; k++){//same depth nodes
            const nodeId=nodes[k]
            const reactFlowNode = reactFlowNodes.find((nd) => nd.id === nodeId);
            if(!reactFlowNode){
                continue 
            }
            try {
                const nodeInstanceFilePath = componentNodes[reactFlowNode.data.name].filePath;
                const nodeModule = await import(nodeInstanceFilePath)
                const newNodeInstance = new nodeModule.nodeClass()
                let flowNodeData = reactFlowNode.data
                if (overrideConfig){
                    flowNodeData = replaceInputsWithConfig(flowNodeData, overrideConfig);
                }
                const reactFlowNodeData = resolveVariables(flowNodeData, reactFlowNodes, question, chatHistory)
                logger.debug(`[server]: Initializing ${reactFlowNode.data.label} (${reactFlowNode.data.id})`);

                reactFlowNode.data.instance = await newNodeInstance.init(reactFlowNodeData, question, {
                    chatId,
                    chatflowid,
                    appDataSource,
                    databaseEntities,
                    logger,
                    cachePool
                })
                logger.debug(`[server]: Finished initializing ${reactFlowNode.data.label} (${reactFlowNode.data.id})`);

            } catch (e) {
                logger.error(e)
                throw new Error(e);
            }
        }
    }

    return reactFlowNodes
}