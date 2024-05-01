const {Qili_Monitor_Name, Flowise_Prediction_Function, keyRunMetadata}=require('./constants')
const monkeyIntercept =require("./monkey-intercept")

function dontCloneDuringPrediction(predictionFxName, flowise){
    if(!predictionFxName in flowise){
        throw new Error(`flowise.${predictionFxName} doesn't exist. Function name may change, please check server code, and then change it in extend-flowise.js and chatflow.js`)
    }
    const lodash=require('lodash')
    monkeyIntercept(lodash,'cloneDeep',fx=>function cloneDeep(a){
        if(new Error().stack.indexOf(predictionFxName)!=-1){
            return a
        }
        return fx.call(this, ...arguments)
    },'dontClone')
}
    
const LatePromise=(a,b)=>{
    (a=new Promise(resolve=>b=resolve)).resolve=b
    return a
}

exports.getEndingNodeId=Object.assign(function(){
    return exports.getEndingNodeId.fx(...arguments)
},{ready:LatePromise()})

exports.getBrowserGraphJS=async function(){
    await exports.getEndingNodeId.ready
    return exports.getBrowserGraphJS.graphJS
}

exports.uploadBuiltin=function(flowise, qili){
    const {post_chatflow_template, post_tool_template}=qili.resolver.Mutation
    const user={_id:flowise.SYSTEM}, ctx={app:qili, user}, _={}
    
    const uploadTools=async builtinTools=>{
        try{
            const uploaded=await qili.findEntity("ToolTemplate",{},{_id:1})
            await Promise.all(
                builtinTools.map(async tool=>{
                    tool._id=tool.name
                    if(!uploaded.find(a=>a._id==tool._id)){
                        return post_tool_template(_,{tool},ctx)
                    }
                })
            )
        }catch(e){
            qili.logger.error(e.message)
        }
    }
    
    const uploadChatFlows=async builtinChatflows=>{
        await exports.getEndingNodeId.ready
        try{
            const uploaded=await qili.findEntity("ChatFlowTemplate",{},{_id:1})
            await Promise.all(
                builtinChatflows.map(async chatflow=>{
                    chatflow._id=chatflow.name.replace(/\s/g,"_")
                    if(!uploaded.find(a=>a._id==chatflow._id)){
                        return post_chatflow_template(_,{chatflow},ctx)
                    }
                })
            )
        }catch(e){
            console.error(e.message)
        }
    }

    monkeyIntercept(flowise.app,'get',fx=>function(path, handler){
        switch(path){
            case '/api/v1/marketplaces/tools':
                handler({},{json:uploadTools})
            break
            case '/api/v1/marketplaces/chatflows':
                handler({},{json:uploadChatFlows})
            break
        }
        return fx.call(this, ...arguments)
    })
}

function uploadIcons(flowise, qili){
    const user={_id:flowise.SYSTEM}
    const ext=icon=>icon.split(".").pop()
    Object.values(flowise.nodesPool.componentNodes).forEach(nodeInstance=>{
        if(nodeInstance.icon){
            qili.upload({overwrite:false, uri:nodeInstance.icon, key:`icons/node/${nodeInstance.name}.${ext(nodeInstance.icon)}`},user)
                .then(url=>nodeInstance.iconUrl=url)
        }
    })
    Object.values(flowise.nodesPool.componentCredentials).forEach(credInstance=>{
        if(credInstance.icon){
            qili.upload({overwrite:false, uri:credInstance.icon, key:`icons/components-credentials/${credInstance.name}.${ext(credInstance.icon)}`},user)
                .then(url=>credInstance.iconUrl=url)
        }
    })
}

exports.extendFlowise=async function initFlowise({flowise, qili}){
    flowise.extractRunMetadata=exports.extractRunMetadata
    
    dontCloneDuringPrediction(Flowise_Prediction_Function,flowise)

    const {componentNodes}=flowise.nodesPool
    const allNodes=Object.values(componentNodes)

    uploadIcons(flowise, qili)

    //extend Node Types, such as extends dynamic list input
    extendQiliAiNodes(componentNodes, flowise)

    //all nodes with qili
    makeAllNodesMetadataReady(allNodes, qili, flowise)

    //extend all tools to support pre processor
    extendAllToolsWithPreTools(allNodes)

    //extend runnable(Agent/Chain) to run/call with customized callbacks/monitors
    extendRunnable(allNodes, qili, flowise)

    /**
     * 
     */
    extendRunManagerTree(flowise)

    extendGraphUtils(flowise)

    extendEmbeddings(flowise)

    componentNodes.ChatFlow={name:"ChatFlow", cost(){}}

    extendCosts(flowise)
}


function extendCosts(flowiseServer){
    const {nodes, credentials}=require("../costs")
    const {componentCredentials, componentNodes}=flowiseServer.nodesPool
    Object.entries(credentials).forEach(([key, cost])=>componentCredentials[key].cost=cost)
    Object.entries(nodes).forEach(([key, cost])=>componentNodes[key].cost=cost)
}


function extendRunManager(runManager, metadata){
    if(!runManager)
        return 
    const runId=require('uuid').v4()
    return new Proxy(runManager,{
        get(runManager, key){
            if(key in runManager){
                return Reflect.get(runManager, key)
            }
            const matched=key.match(/handle(?<Type>.*)[Start|End|Error]/)
            if(matched){
                return async (data)=>{
                    return Promise.all(
                        runManager.handlers.map(async handler=>{
                            if(!handler[`ignore${matched.groups.Type}`]){
                                await handler[key]?.(data, runManager.runId||runId, runManager._parentRunId,runManager.tags, {...runManager.metadata, ...metadata})
                            }
                        })
                    )
                }
            }
        }
    })
}

function extendEmbeddings(flowise){
    Object.values(flowise.nodesPool.componentNodes)
        .filter(a=>a.category=="Vector Stores")
        .forEach(vectorStoreNode=>{
            monkeyIntercept(vectorStoreNode.constructor.prototype, 'init', fx=>async function(){
                const retrieverOrStore=await fx.call(this, ...arguments)
                const vectorStore=store=retrieverOrStore.vectorStore||retrieverOrStore
                debugger
                ;['similaritySearch','similaritySearchWithScore'].forEach(fxName=>{
                    vectorStore[fxName]= vectorStore[fxName]
                    monkeyIntercept(vectorStore, fxName, fx=>async function(){
                        const [,,,runManager]=arguments
                        this.embeddings.runManager=extendRunManager(runManager, this.embeddings.metadata)
                        const docs= await fx.call(this, ...arguments)
                        delete this.embeddings.runManager
                        return docs
                    }) 
                })

                monkeyIntercept(vectorStore.embeddings, 'embedQuery', fx=>async function(query){
                    this.runManager?.handleEmbedQueryStart?.(query)
                    try{
                        const result= await fx.call(this, ...arguments)
                        this.runManager?.handleEmbedQueryEnd?.({vectors:result, tokensUsage: this.tokensUsage})
                        return result
                    }catch(error){
                        this.runManager?.handleEmbedQueryError?.(error)
                    }
                }) 

                return retrieverOrStore
            },'runManager for vector')
        })
}


function extendGraphUtils(flowise){
    flowise.Utils.originalConstructGraphs=flowise.Utils.originalConstructGraphs||flowise.Utils.constructGraphs
    const {originalConstructGraphs } = flowise.Utils
    const {getStartingNodes, buildLangchain, getEndingNode}=require("./graph")
    monkeyIntercept(flowise.Utils,'getStartingNodes', fx=>function(){
        return getStartingNodes(...arguments)
    },"once")

    monkeyIntercept(flowise.Utils,'buildLangchain', fx=>function(){
        return buildLangchain(...arguments)
    },"once")

    monkeyIntercept(flowise.Utils,'getEndingNode', fx=>function(){
        return getEndingNode(...arguments)
    },"once")

    monkeyIntercept(flowise.Utils,'constructGraphs', fx=>function(nodes,edges,isNondirected=false){
        const result=fx(...arguments)
        if(isNondirected){
            Object.defineProperties(result.graph,{
                directed:{
                    enumerable:false,
                    get(){
                        return fx(nodes, edges)
                    }
                }    
            }) 
        }
        return result
    },"once")

    // browser side graph utils
    exports.getEndingNodeId.fx = flowData => {
        try{
            const { nodes, edges } = typeof(flowData)=="string" ? JSON.parse(flowData) : flowData
            const { graph, nodeDependencies } = originalConstructGraphs(nodes, edges)
            return getEndingNode(nodeDependencies, graph)
        }catch(e){
            return null
        }
    }

    exports.getBrowserGraphJS.graphJS = `
        const getEndingNode=${getEndingNode.toString()}
        const originalConstructGraphs=${originalConstructGraphs.toString()}
        globalThis.graph={
            constructGraphs:originalConstructGraphs,
            getEndingNode:${exports.getEndingNodeId.fx.toString()},

            extractNodeGraph: ${exports.extractNodeGraph.toString()},
            overrideGraphInputs: ${exports.overrideGraphInputs.toString()},
            overrideNodeAnchors: ${exports.overrideNodeAnchors.toString()},
        }
        //it's for development
        if(!document.querySelector('head>script')){
            const script=document.createElement('script')
            script.src="http://localhost:3000/static/js/bundle.js"
            script.setAttribute('defer','on')
            document.querySelector('head').appendChild(script)
        }
    `
    exports.getEndingNodeId.ready.resolve()

}
 
function extendRunManagerTree(flowise){
    monkeyIntercept(flowise.Handlers, 'additionalCallbacks', fx=>async function(nodeData, options){
        const callbacks=await fx.call(this, ...arguments)
        const runMetadata=exports.extractRunMetadata(options)
        callbacks.unshift(runMetadata.monitor)
        return callbacks
    },'inject monitor')

    /**patch-package implements it */
    //  monkeyIntercept(flowise.CallbackManager, 'configure', fx=>async function(){
    //     const callbackManager=await fx.call(this,...arguments)
    //     if(callbackManager && !callbackManager._parentRunId){
    //         const Qili_Monitor_Name="qili_monitor"
    //         callbackManager._parentRunId=callbackManager.metadata.parentRunId 
    //         if(!callbackManager._parentRunId){
    //             const monitor=[...callbackManager.handlers, ...callbackManager.inheritableHandlers].find(a=>a.name==Qili_Monitor_Name)
    //             callbackManager._parentRunId=monitor.rootRunId
    //         }
    //     }
    //     return callbackManager
    //  },'set parentRunId')
}

function extendRunnable(allNodes, qili, flowise) {
    allNodes.filter(a => !!a.run).forEach(a => {
        //all runnable should be evaluatable, so add evaluators
        a.inputs.unshift({
            label: 'Pre',
            name: 'preAction',
            type: 'Runnable',
            description:"pre action tool on input, such as stt",
            optional: true
        })

        a.inputs.push({
            label: 'Post',
            name: 'postAction',
            type: 'Runnable',
            description:"post action tool on output, such as tts",
            optional: true
        })

        a.inputs.push({
            label: 'Evaluators',
            name: 'evaluators',
            type: 'CriteriaEvaluator',
            description:"Use it as test cases",
            list: true,
            optional: true
        })
        
        
        monkeyIntercept(a.constructor.prototype, 'run', f1 => async function (node, input, options) {
            /**
             * @@hack: chathistory has {runId, user}, set by ChatFlow.predict
             * callback/monitor should have runtime information, such as runId, user
             * 
             * ConsoleCallbackHandler is hacked since every agent has it
             * it should emit information, but how to make it identifable by runId, or user
             */
            
            const { instance: chainOrAgent, inputs:{evaluators, postAction, preAction} }=node
            if(chainOrAgent.call){
                monkeyIntercept(chainOrAgent,'call', f2 => async function (input, config) {
                    const strip=(schema,inputs)=>{
                        if(schema.shape){
                            inputs={...inputs}
                            const keys=Object.keys(schema.shape)
                            Object.keys(inputs).forEach(k => !keys.includes(k) && delete inputs[k])
                            return inputs
                        }
                        return {}
                    }
                    if(preAction){
                        const inputs=strip(preAction.schema,preAction.metadata.node.inputs)
                        const transformed=await preAction.call({...inputs, ...input}, config)
                        input={input:transformed}
                    }

                    const prediction= await f2.call(this, input, config)

                    const outputKey=extractOutputKey(prediction)
                
                    if(postAction){
                        const inputs=strip(postAction.schema,postAction.metadata.node.inputs)
                        const output=await postAction.call({...inputs, input:extractText(prediction)}, config)
                        prediction[outputKey]=output
                    }

                    const runMetadata=exports.extractRunMetadata(options)
                    if(runMetadata.evaluating && !runMetadata.parentRunId){
                        const evaluator=evaluators.find(a=>a.metadata.node.id==runMetadata.evaluating)
                        const outputText=extractText(prediction)
                        const evaluateInput=extractText(input)
                        if(runMetadata.shouldEvaluate){
                            const evaluateResult= await evaluator.evaluate({
                                input:evaluateInput,
                                prediction:outputText,
                            }, {}, config)
                            evaluateResult.input=evaluateInput
                            evaluateResult.output=outputText
                            return {[outputKey]:JSON.stringify(evaluateResult)}
                        }else{
                            return {[outputKey]:JSON.stringify({
                                shouldEvaluate:false,
                                input, 
                                output:outputText, 
                            })}
                        }
                    }
                    return prediction
                })
            }

            return await f1.call(this, ...arguments)
        },'runnable')
    })
}

function extendAllToolsWithPreTools(allNodes) {
    allNodes.filter(a => a.category == "Tools" && a.type!="Adaptable").forEach(a => {
        a.inputs=a.inputs||[]
        a.inputs.unshift({
            label: "Pre",
            name: "preAction",
            type: "Runnable",
            optional: true,
            description:"use it to chain tools"
        })

        monkeyIntercept(a.constructor.prototype,'init', init => async function (node) {
            const tool = await init.call(this, ...arguments)
            if(node.name=="customTool"){
                tool.returnDirect=node.inputs.returnDirect
            }

            monkeyIntercept(tool, '_call', fx2 => async function (input, runManager) {
                if (node.inputs?.preAction) {
                    try{
                        input = await node.inputs.preAction.call(
                            {input}, 
                            runManager?.getChild()
                        )
                    }catch(error){
                        return error
                    }
                }
                return await fx2.call(this, input, runManager)

            })

            return tool
        }, 'pretool')

    })
}

function makeAllNodesMetadataReady(allNodes, qili, flowise) {
    allNodes.forEach(a => {
        monkeyIntercept(a.constructor.prototype, 'init' ,fx => async function ({id,name, credential, inputs}) {
            const langchainNode = await fx.call(this, ...arguments, qili, flowise)
            if(typeof(langchainNode)=="object" && !langchainNode.metadata?.node){
                langchainNode.metadata=langchainNode.metadata||{}
                Object.assign(langchainNode.metadata,{
                    node:{
                        id,name,
                        inputs,
                        credential
                    }
                })
            }

            return langchainNode
        }, 'metadata')
    })
}

function extendQiliAiNodes(componentNodes, flowise) {
    const extendNodes = require('./nodes')
    const extended=Object.keys(extendNodes).map(name => {
        if (componentNodes[name] && typeof (extendNodes[name]) == "function") {
            extendNodes[name](componentNodes[name], flowise)
            return name
        }
        console.warn(`Flowise Node[${name}] can't extend because of wrong name or not a extend function`)
    }).filter(a=>!!a)

    extended.length && console.log(`${extended.join(",")} extended in cloud module`)
}

/**
 * use chat history to pass metadata of a single ChatFlow run
 */
exports.injectRunMetadata=function(runConfig, metadata){
    if(!runConfig.history){
        runConfig.history=[]
    }
    runConfig.history[keyRunMetadata]=metadata
    return runConfig
}
exports.extractRunMetadata=function(runConfig){
    return runConfig.chatHistory?.[keyRunMetadata]
}

/**
 * It's different from prediction overrideConfig
 * extend: {[nodeId]:{$name:{...variables}}
 * @param {*} patch :{[nodeId]:{credential, ...inputs}}
 * @param {*} graph 
 * @returns 
 */
exports.overrideGraphInputs=function(patch, graph){
    const {nodes}=graph
    Object.keys(patch).forEach(nodeId=>{
        const node=nodes.find(a=>a.id==nodeId)
        if(node){
            if(patch[nodeId]){
                const {credential, ...extra}=patch[nodeId]
                if(typeof(credential)!='undefined'){
                    node.data.credential=credential
                }
                node.data.inputs={
                    ...node.data.inputs,
                    ...extra
                }
            }
        }else{//
            const switchNode=nodes.find(a=>a.data.inputs?.switchName===nodeId)
            if(switchNode){
                switchNode.data.inputs.selectedOption=patch[nodeId]
            }
        }
    })
    return arguments[1]
}

/**
 * extract graph of a node
 * @param {*} nodeId 
 * @param {*} graph 
 * @returns 
 */
exports.extractNodeGraph=function(nodeId, graph){
    const {nodes, edges}=graph
    const extractedNodes=[], extractedEdges=[]

    function extract1(targetId){
        const target=nodes.find(a=>a.id==targetId)
        extractedNodes.push(target)

        const valid=a=>["preTool"].indexOf(a.name)==-1
        target.data.inputAnchors.filter(valid).forEach(anchor=>{
            const anchorEdges=edges.filter(edge=>edge.target==targetId && edge.targetHandle==anchor.id)
            anchorEdges.forEach(edge=>{
                extractedEdges.push(edge)
                extract1(edge.source)
            })
        })
    }

    extract1(nodeId)
    if(extractedEdges.length==0 || nodes.length<1){
        return 
    }

    return JSON.parse(JSON.stringify({
        nodes:extractedNodes,
        edges:extractedEdges
    }))
}

/**
 * apply overriding config() of a node to graph
 * @param {*} patch : is overriding config of target node. It's usually from exports.extractNodeGraph
 * @param {*} graph : is target chatflow's graph
 * @param {*} nodeId : target node id, which usually is graph's ending node
 * @returns updated graph
 */
exports.overrideNodeAnchors=function(patch, graph, nodeId){
    const {nodes, edges}=graph
    patch=JSON.parse(JSON.stringify(patch))
    const target=nodes.find(a=>a.id==nodeId)

    const placeholder=patch.nodes[0]

    const overrideAnchors=patch.edges.filter(a=>a.target==placeholder.id).map(a=>a.targetHandle)
    
    //clear
    ;(function removeEdges(removingEdges){
        removingEdges.forEach(edge=>edges.splice(edges.indexOf(edge),1))
        
        removingEdges.forEach(function removeEdge(edge){
            const source=edge.source
            const node=nodes.find(a=>a.id==source)
            if(edges.find(a=>a.source==source)){//
                console.warn(`can't directly remove because of multiple output targets`)
            }else{//safe to remove this node
                nodes.splice(nodes.indexOf(node),1)
                removeEdges(edges.filter(a=>a.target==node.id))
            }
        })
    })(
        edges.filter(edge=>edge.target==target.id && overrideAnchors.indexOf(edge.targetHandle)!=-1)
    );

    //name conflict
    patch.nodes.slice(1).forEach(node=>{
        if(nodes.find(a=>a.id==node.id)){
            const newId=`${Date.now()}`
            patch.edges.forEach(a=>{
                if(a.source==node.id){
                    a.source=newId
                }else if(a.target==node.id){
                    a.target=newId
                }
            })
            node.id=node.data.id=newId
        }
    })

    //link patch edges to chatflow
    patch.edges
        .filter(edgeInPatch=>edgeInPatch.target==placeholder.id)
        .forEach(edgeInPatch=>{
            edgeInPatch.target=nodeId
        })

    nodes.splice(nodes.length,0, ...patch.nodes.slice(1))
    edges.splice(edges.length,0, ...patch.edges)
    return graph
}

function extractText(ob){
    if(typeof(ob)=="object"){
        const key=extractOutputKey(ob)
        const text=ob[key]
        return extractText(text)
    }
    return ob
}

function extractOutputKey(ob){
    return Object.keys(ob)[0]
}

/**
every runnable node should be monitored, since cost is monitored by monitor through CallbackManager, which is managed
through runId, so a runId hierarchy tree should be created during prediction. 

how to make CallbackManager initilization contextified with a prediction
> runnable nodes tree
> pre/post tools 
> evaluators
> Agent
> runnable during node intilizing: LLMChain

what metadata are needed in events:
> qili, user, chatflow
> node
> monitor callback


Runnable Solution: {userId, flowise, qili, socketIo, chatflowId}
> callback Handers injected: run method of runnable node is monkey intercepted to inject QiliMonitor
> call(values, config), config has both callbackHandlers, and metadata.parentRunId
> tool/chain/agent call/run will instantiate CallbackManager with metadata.parentRunId set

There are some exceptions out of CallbackManager, such as 
> Embeddings: [done] no callback manager at all, solution is implemented.
> LLMChain: when output is output prediction, it predict as string during node initialization
> AutoGPT, BabyAGI: no CallbackManager at all

Potential Solutions:
* monkeyIntercept additionalCallbacks, so LLMChain can be resolved, and runnable solution is implemented as well.

 */