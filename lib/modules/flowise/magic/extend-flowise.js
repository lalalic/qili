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
        const uploaded=(await qili.findEntity("ToolTemplate",{},{name:1})).map(a=>a.name)
        await Promise.all(
            builtinTools
                .filter(a=>uploaded.indexOf(a.name)==-1)
                .map(tool=>{
                    return post_tool_template(_,{tool},ctx)
                })
        )
    }
    
    const uploadChatFlows=async builtinChatflows=>{
        await exports.getEndingNodeId.ready
        const uploaded=(await qili.findEntity("ChatFlowTemplate",{},{name:1})).map(a=>a.name)
        await Promise.all(
            builtinChatflows
                .filter(a=>uploaded.indexOf(a.name)==-1)
                .map(chatflow=>{
                    return post_chatflow_template(_,{chatflow},ctx)
                })
        )
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

    extendCredentialCost(flowise)

    extendCustomToolCost(flowise)

    extendEmbeddings(flowise)

    componentNodes.qiliRoot={
        name:"qiliRoot",
        cost(){
            return 0
        }
    }
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

function extendCredentialCost(flowise){
    const costFx=require('./credentials')
    Object.keys(costFx).forEach(creName=>{
        const cred=flowise.nodesPool.componentCredentials[creName]
        if(cred){
            cred.cost=costFx[creName]
        }
    })
}

function extendCustomToolCost(flowise){

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

function clear(ob){
    return JSON.parse(JSON.stringify(ob,(key,value)=>{
        if(key===""){
            return value
        }
        if(value==="" 
            || key.indexOf(".")!=-1 
            || ["undefined", "function"].indexOf(typeof(value))!=-1
            || (value && typeof(value)=="object" && Object.keys(value).length==0)){
            return
        }
        return value
    }))
}
 
exports.monitorFactory=function monitorFactory(flowise, qili){
    function safe(node){
        try{
            node.inputs=clear(node.inputs)
            return node
        }catch(e){
            console.error(e.message)
            console.error(node)
        }
    }

    return class QiliMonitor extends flowise.Handlers.LLMonitor{
        constructor({author:userId, chatflowId, runMonitorSocket, rootRunId}){
            super()
            const me=this
            this.rootRunId=rootRunId||require('uuid').v4()
            this.name=Qili_Monitor_Name
            this.queue=Promise.resolve()
            this.socketIO={
                emit(){
                    flowise.socketServer.to(runMonitorSocket).emit(...arguments)
                }
            }
            this.monitor={
                async trackEvent(type,event,data){
                    const {runId, parentRunId, tokensUsage,
                        extra:{runMonitorSocket:_0,predict:_1,parentRunId:_2,silent:_3,extractNodeGraph:_4,functions:_5,node, ...extra}={}, 
                        ...extraData}=data
                    qili.emit("predict",{type, event, data})  
                    switch (event) {
                        case "start":{
                            if(!parentRunId){
                                extraData.chatflow=chatflowId
                            }
                            const args=["Run",{
                                _id: runId,
                                parent_run: parentRunId,
                                type,
                                status: "started",
                                ...extraData,
                                ...extra,
                                name:node?.name,
                                node:node ? safe(node) : undefined,
                                author: userId,
                            }]
                            me.push(()=>qili.createEntity(...args).then(a=>me.track(...args)))
                
                            break;
                        }
                        case "end":{
                            const args=["Run",{_id:runId}, {
                                status: "success",
                                prompt_tokens: tokensUsage?.prompt,
                                completion_tokens: tokensUsage?.completion,
                                author: userId,
                                ...extraData
                            }]
                            me.push(()=>qili.patchEntity(...args).then(a=>me.track(...args)))
                
                            break;
                        }
                        case "error":{
                            const args=["Run",{ _id: runId },{
                                status: "error",
                                error,
                                author: userId,
                                ...extraData
                            }]
                            me.push(()=>qili.patchEntity(...args).then(a=>me.track(...args)))
                            break;
                        }
                        case "feedback":{
                            me.push(async ()=>{
                                const data = await req.app.get1Entity("Run",{ _id: runId }, {feedback:1})
                                const args=["Run", { _id: runId },{
                                    author: userId,
                                    feedback: {
                                        ...(data?.feedback || {}),
                                        ...extra,
                                    },
                                }]
                                return qili.patchEntity(...args).then(a=>me.track(...args))
                            })
                            break
                        }
                    }
                }
            }

            this.clone=props=>new this.constructor({...arguments[0],...props})
        }

        async start(type='prediction'){
            await this.monitor.trackEvent(type,'start', {runId:this.rootRunId, extra:{node:{name:"qiliRoot", inputs:{}}}})
        }

        async end(type='prediction'){
            await this.monitor.trackEvent(type, 'end', {runId:this.rootRunId, extra:{node:{name:"qiliRoot", inputs:{}}}})
            this.socketIO.emit('done')  
        }

        async push(job){
            this.queue=this.queue.then(async ()=>{
                try{
                    await job()
                }catch(e){
                    console.error(e.message)
                }
            })
        }

        async handleRetrieverStart(retriever, query, runId, parentRunId, tags, metadata){
            await this.monitor.trackEvent("retriever", "start", {
                runId,
                parentRunId,
                extra: metadata,
                tags,
                runtime: "langchain-js",
                input:query,
            });
        }

        async handleRetrieverEnd(documents, runId){
            await this.monitor.trackEvent("retriever", "end",{
                runId,
                output: `${documents.length} documents`
            })
        }

        async handleRetrieverError(error, runId){
            await this.monitor.trackEvent("retriever", "error", {
                runId,
                error
            })
        }

        async handleEmbedQueryStart(query, runId, parentRunId, tags, metadata){
            await this.monitor.trackEvent("embedding", "start", {
                runId,
                parentRunId,
                extra: metadata,
                tags,
                runtime: "langchain-js",
                input:query,
            });
        }

        async handleEmbedQueryEnd({vectors, tokensUsage:{model,...tokensUsage}}, runId){
            await this.monitor.trackEvent("embedding", "end",{
                runId,
                model,
                tokensUsage,
                output:`${vectors.length} vectors`
            })
        }

        async handleEmbedQueryError(error, runId){
            await this.monitor.trackEvent("embedding", "error", {
                runId,
                error
            })
        }

        /** lazy to pass */
        track(_, filter, docOrPatch){
            const doc={...filter, ...docOrPatch}
            const {_id, parent_run, status, input, output, node, author}=doc
            const data={_id, parent_run, status, input:!!input && clear(input), output:!!output && clear(output), node}
            Object.keys(data).forEach(k=>{
                if(!data[k]){
                    delete data[k]
                }
            })
            this.socketIO?.emit('monitor', data)
            
            if(status=="success" || status=="error"){
                (async()=>{
                    const cost=await qili.resolver.Run.cost({...data}, {runId:_id}, {app:qili, user:{_id:author}})
                    if(cost){
                        this.socketIO.emit('cost', cost)
                    }
                })();
            }
            return arguments
        }
    }
}

function extendRunManagerTree(flowise){
    monkeyIntercept(flowise.Handlers, 'additionalCallbacks', fx=>async function(nodeData, options){
        const callbacks=await fx.call(this, ...arguments)
        const runMetadata=exports.extractRunMetadata(options)
        callbacks.unshift(runMetadata.monitor)
        return callbacks
    },'inject monitor')

     monkeyIntercept(flowise.CallbackManager, 'configure', fx=>async function(){
        const manager=await fx.call(this,...arguments)
        if(manager && !manager._parentRunId){
            manager._parentRunId=manager.metadata.parentRunId 
            if(!manager._parentRunId){
                const monitor=[...manager.handlers, ...manager.inheritableHandlers].find(a=>a.name==Qili_Monitor_Name)
                manager._parentRunId=monitor.rootRunId
            }
        }
        return manager
     },'set parentRunId')
}

function extendRunnable(allNodes, qili, flowise) {
    allNodes.filter(a => !!a.run).forEach(a => {
        //all runnable should be evaluatable, so add evaluators
        a.inputs.unshift({
            label: 'Pre',
            name: 'preAction',
            type: 'Tool',
            description:"pre action tool on input, such as stt",
            optional: true
        })

        a.inputs.push({
            label: 'Post',
            name: 'postAction',
            type: 'Tool',
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
                    if(preAction){
                        const {inputs:{pre, selectedTool, ...inputs}}=preAction.metadata.node
                        const transformed=await preAction.call({...inputs, ...input}, config)
                        input={input:transformed}
                    }

                    const prediction= await f2.call(this, input, config)

                    const outputKey=extractOutputKey(prediction)
                
                    if(postAction){
                        const {inputs:{pre, selectedTool, ...inputs}}=postAction.metadata.node
                        const output=await postAction.call({...inputs, input:extractText(prediction)}, config)
                        prediction[outputKey]=output
                    }

                    const runMetadata=exports.extractRunMetadata(options)
                    if(runMetadata.evaluating && !runMetadata.parentRunId){
                        const evaluator=evaluators.find(a=>a.metadata.node.id==runMetadata.evaluating)
                        const evaluateInput=extractText(input)
                        const outputText=extractText(prediction)
                        const evaluateResult= await evaluator.evaluate({
                            input:evaluateInput,
                            prediction:outputText,
                        }, {}, config)
                        evaluateResult.input=evaluateInput
                        evaluateResult.output=outputText
                        return {[outputKey]:JSON.stringify(evaluateResult)}
                    }
                    return prediction
                })
            }

            return await f1.call(this, ...arguments)
        },'runnable')
    })
}

function extendAllToolsWithPreTools(allNodes) {
    allNodes.filter(a => a.category == "Tools").forEach(a => {
        ;(a.inputs=a.inputs||[]).unshift({
            label: "Pre",
            name: "preAction",
            type: "Tool",
            optional: true,
            description:"use it to chain tools"
        })

        monkeyIntercept(a.constructor.prototype,'init', init => async function (node) {
            const tool = await init.call(this, ...arguments)

            monkeyIntercept(tool, '_call', fx2 => async function (input, runManager) {
                if (node.inputs?.pre) {
                    try{
                        input = await node.inputs.pre.call(
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
            if(typeof(langchainNode)=="object"){
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


exports.overrideGraphInputs=function(patch, {nodes}){
    Object.keys(patch).forEach(nodeId=>{
        const node=nodes.find(a=>a.id==nodeId)
        if(node && patch[nodeId]){
            const {credential, ...extra}=patch[nodeId]
            if(typeof(credential)!='undefined'){
                node.data.credential=credential
            }
            node.data.inputs={
                ...node.data.inputs,
                ...extra
            }
        }
    })
    return arguments[1]
}

exports.extractNodeGraph=function(nodeId, {nodes, edges}){
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

exports.overrideNodeAnchors=function(patch, {nodes, edges}, targetId){
    patch=JSON.parse(JSON.stringify(patch))
    const target=nodes.find(a=>a.id==targetId)

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
            edgeInPatch.target=targetId
        })

    nodes.splice(nodes.length,0, ...patch.nodes.slice(1))
    edges.splice(edges.length,0, ...patch.edges)
    return arguments[1]
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