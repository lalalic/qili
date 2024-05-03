const { resolveVariables, databaseEntities, getVariableValue}=require("flowise/dist/utils")
const logger=require("flowise/dist/utils/logger").default

exports.asTargetToSourceGraph=function(biGraph, endNodeId){
    const sourceToTargetGraph=biGraph.directed.graph
    const sources=Object.keys(sourceToTargetGraph)
    const targetss=Object.values(sourceToTargetGraph)
    const targetToSourceGraph=sources.reduce((graph, id)=>(graph[id]=[],graph),{})
    
    const findAllSourcesOf=targetNode=>{
        return targetss.map((targets,iSource)=>{
            const i=targets.indexOf(targetNode)
            if(i!=-1){
                targets.splice(i,1)
                targetToSourceGraph[targetNode].push(sources[iSource])
                return sources[iSource]
            }
        }).flat().filter(a=>!!a)
    }

    const transformCurrentEndingNodes=(endingNodes)=>{
        if(endingNodes.length==0){
            //get leaf nodes
            endingNodes=sources.filter((a,i)=>{
                if(targetss[i].length==0){
                    return true
                }
            })

            //clear source -> targets for leaf nodes, targets should be empty
            endingNodes.forEach(a=>{
                const i=sources.indexOf(a)
                sources.splice(i,1)
                targetss.splice(i,1)
            })
        }

        if(!endingNodes.length)
            return

        if(sources.length>0){
            const targetSources=endingNodes.map(findAllSourcesOf).flat()
            transformCurrentEndingNodes(targetSources)
        }
    }

    transformCurrentEndingNodes([])

    return targetToSourceGraph
}

exports.getStartingNodes=function(graph, endNodeId){
    const targetToSourceGraph=exports.asTargetToSourceGraph(graph, endNodeId)

    const startingNodeIds=Object.keys(targetToSourceGraph).filter(nodeId=>targetToSourceGraph[nodeId].length==0)
    const depthQueue={[endNodeId]:0}
    const depth=(current,d)=>{
        //first depth all, then go deep for multiple links
        targetToSourceGraph[current].forEach(nodeId=>{
            depthQueue[nodeId]=d+1
        })

        targetToSourceGraph[current].forEach(nodeId=>{
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
 * build from low depth (starting node) to high(ending node)
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
                //const nodeInstanceFilePath = componentNodes[reactFlowNode.data.name].filePath;
                //const nodeModule = await import(nodeInstanceFilePath)
                //const newNodeInstance = new nodeModule.nodeClass()
                const newNodeInstance = new componentNodes[reactFlowNode.data.name].constructor() 
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
                    cachePool,
                    chatHistory,//append since it hold runMetadata
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

exports.getEndingNode=function(nodeDependencies, sourceToTargetGraph){
    const nodesWithoutTarget=Object.keys(sourceToTargetGraph)
        .filter(key=>sourceToTargetGraph[key].length==0)
    
    //more dependency, more possible being ending node if there are multiple ending node
    //the best is to check category Agent, Chain
    const sortByDepends=nodesWithoutTarget.sort((a,b)=>nodeDependencies[b]-nodeDependencies[a])
    return sortByDepends[0]
}

/**
 * 
 */
function replaceInputsWithConfig(flowNodeData, overrideConfig){
    var _a;
    const types = 'inputs';
    const getParamValues = (paramsObj) => {
        var _a;
        for (const config in overrideConfig) {
            // If overrideConfig[key] is object
            if (overrideConfig[config] && typeof overrideConfig[config] === 'object') {
                const nodeIds = Object.keys(overrideConfig[config]);
                if (nodeIds.includes(flowNodeData.id)) {
                    paramsObj[config] = overrideConfig[config][flowNodeData.id];
                }
                continue;
            }
            let paramValue = (_a = overrideConfig[config]) !== null && _a !== void 0 ? _a : paramsObj[config];
            // Check if boolean
            if (paramValue === 'true')
                paramValue = true;
            else if (paramValue === 'false')
                paramValue = false;
            paramsObj[config] = paramValue;
        }
    };
    const paramsObj = (_a = flowNodeData[types]) !== null && _a !== void 0 ? _a : {};
    getParamValues(paramsObj);
    return flowNodeData;
}

/**
 * problem: some node execution can't be montiored, such as LLMChain, BabyAGI, AutoGPT
 * solutions:
 * 1 > check every node, and refactor the node that can not be injected
 * 2 > use run always to resolve anything in node
 *  >> change the way to resolve 
 */
function getVariableValueEx(paramValue, reactFlowNodes, question, chatHistory, isAcceptVariable = false){
    const paramKey=Object.keys(reactFlowNodes.inputs.key).find(key=>reactFlowNodes.inputs[key]===paramValue)
    const param=reactFlowNodes.inputParams.find(a=>a.name==paramKey)

    if(param.type=="json" && isAcceptVariable){
        return JSON.parse(paramValue,function(target, key, value){
            if(value.startsWith("{{") && value.endsWith("}}")){
                const variableFullPath=value.substring(2,value.length-2)
                const [variableNodeId, _] = variableFullPath.split('.');
                const executedNode = reactFlowNodes.find((nd) => nd.id === variableNodeId);
                return executedNode.data.instance
            }
            return value
        })
    }

    return getVariableValue(...arguments)
}

