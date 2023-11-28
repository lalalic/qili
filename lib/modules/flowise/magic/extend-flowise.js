const monkeyIntercept =require("./monkey-intercept")

function dontCloneDuringPrediction(){
    const lodash=require('lodash')
    monkeyIntercept(lodash,'cloneDeep',fx=>function cloneDeep(a){
        if(new Error().stack.indexOf("processPrediction")!=-1){
            return a
        }
        return fx.call(this, ...arguments)
    })
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
    const {post_chatflow, post_tool}=qili.resolver.Mutation
    const user={_id:"system"}, ctx={app:qili, user}, _={}
    
    const uploadTools=async builtinTools=>{
        const uploaded=(await qili.findEntity("Tool",{author:user._id},{name:1})).map(a=>a.name)
        await Promise.all(
            builtinTools
                .filter(a=>uploaded.indexOf(a.name)==-1)
                .map(tool=>{
                    tool.isPublic=true
                    return post_tool(_,{tool},ctx)
                })
        )
    }
    
    const uploadChatFlows=async builtinChatflows=>{
        await exports.getEndingNodeId.ready
        const uploaded=(await qili.findEntity("ChatFlow",{author:user._id},{name:1})).map(a=>a.name)
        await Promise.all(
            builtinChatflows
                .filter(a=>uploaded.indexOf(a.name)==-1)
                .map(chatflow=>{
                    chatflow.isPublic=true
                    return post_chatflow(_,{chatflow},ctx)
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

    monkeyIntercept(flowise.app,'use',fx=>function(path, handler){
        if(path=='/'){//@hack: all direct to /
            flowise.app.use=a=>a
            return 
        }
        return fx.call(this, ...arguments)
    }) 
}

exports.extendFlowise=async function initFlowise({flowise, qili}){
    dontCloneDuringPrediction()

    const {componentNodes}=flowise.nodesPool
    const allNodes=Object.values(componentNodes)

    makeBrowserGraphUtils(flowise)

    //no chatflow cache
    clearChatflowPool(flowise)

    //extend Node Types, such as extends dynamic list input
    extendQiliAiNodes(componentNodes, flowise)

    //all nodes with qili
    makeAllNodesMetadataReady(allNodes, qili, flowise)

    //extend all tools to support pre processor
    extendAllToolsWithPreTools(allNodes)

    //extend runnable(Agent/Chain) to run/call with customized callbacks/monitors
    extendRunnable(allNodes, qili, flowise)

    /**
     * create chain between main chatflow-> sub chatflow by metadata.parentRunId ->runManager.parentRunId
     * 1. ChatflowTool get parent run id
     * 2. metadata.predict(question, config, parentRunId)
     * 3. ChatFlow.predict() -> metadata in config.history 
     * 4. Agent/Chain pick up metadata from options.chatHistory #makeAllNodesMetadataReady
     */
    extendRunManagerParentRunIdFromMetadata(flowise)

    extendQiliVectorStore(qili)

    extendBuildLangChain(flowise)
}

function extendBuildLangChain(flowise){
    const {getStartingNodes, buildLangchain}=require("./graph")
    monkeyIntercept(flowise.constructor.prototype.Utils,'getStartingNodes', fx=>function(){
        return getStartingNodes(...arguments)
    })

    monkeyIntercept(flowise.constructor.prototype.Utils,'buildLangchain', fx=>function(){
        return buildLangchain(...arguments)
    })
/*
    monkeyIntercept(flowise.constructor.prototype.Utils,'buildLangchain', fx=>function(){
        const [startingNodeIds, , , depthQueue]=arguments
        startingNodeIds.sort((a,b)=>depthQueue[b]-depthQueue[a])
        return fx.call(this, ...arguments)
    })
    */
}

function clear(ob){
    return JSON.parse(JSON.stringify(ob,(key,value)=>{
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
        node.inputs=clear(node.inputs)
        return node
    }

    // return class QiliMonitor extends require('langchain/callbacks').LangChainTracer{
    //     constructor({author, chatflowId}){
    //         super()
    //         this.name='qili_callback_handler'
    //         Object.assign(this, arguments[0])
    //         this.socketIO=null//it will be injected

    //     }

    //     persistRun1({id, ...run}){
    //         const data={_id:id, ...run}
    //         qili.resolver.Run.upsert({},{run:data}, {app:qili, user: {_id:author}})
    //         this.socketIO.emit('monitor', data)
    //     }
    // }


    return class QiliMonitor extends flowise.Handlers.LLMonitor{
        constructor({author:userId, chatflowId}){
            super()
            const me=this
            this.socketIO=null//it will be injected
            this.name='qili_callback_handler'
            this.queue=Promise.resolve()
            this.monitor={
                async trackEvent(type,event,data){
                    const {runId, parentRunId, tokensUsage,
                        extra:{predict:_1,parentRunId:_2,silent:_3,extractNodeGraph:_4,functions:_5,node, ...extra}={}, 
                        ...extraData}=data
                    qili.emit("predict",{type, event, data})  
                    switch (event) {
                        case "start":
                            if(!parentRunId){
                                extraData.chatflow=chatflowId
                            }
                            me.push(()=>qili.createEntity(...me.track("Run",{
                                _id: runId,
                                parent_run: parentRunId,
                                type,
                                status: "started",
                                ...extraData,
                                ...extra,
                                name:node.name,
                                node:safe(node),
                                author: userId,
                            })))
                
                            break;
                        case "end":
                            me.push(()=>qili.patchEntity(...me.track("Run",{_id:runId}, {
                                status: "success",
                                prompt_tokens: tokensUsage?.prompt,
                                completion_tokens: tokensUsage?.completion,
                                author: userId,
                                ...extraData
                            })))
                
                            break;
                        case "error":
                            me.push(()=>qili.patchEntity(...me.track("Run",{ _id: runId },{
                                    status: "error",
                                    error,
                                    author: userId,
                                    ...extraData
                                })))
                            break;
                        case "feedback":
                            me.push(async ()=>{
                                const data = await req.app.get1Entity("Run",{ _id: runId }, {feedback:1})
                                return qili.patchEntity(...me.track("Run", { _id: runId },{
                                    author: userId,
                                    feedback: {
                                        ...(data?.feedback || {}),
                                        ...extra,
                                    },
                                }))
                            })
                            break
                    }
                }
            }
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
            /*
            if(status=="success" || status=="error"){
                (async()=>{
                    const cost=await qili.resolver.Mutation.cost({}, {run:doc}, {app:qili, user:{_id:author}})
                    if(cost){
                        this.socketIO.emit('cost', cost)
                    }
                })();
            }
            */
            return arguments
        }
    }
}

function extendRunManagerParentRunIdFromMetadata(flowise){
    /**
     * @@hack:
     * it's a hack to pass on parentRunId, when there's sub chatflow 
     * CallbackManager.configure() will 
     */
     monkeyIntercept(flowise.CallbackManager.prototype, 'addMetadata', fx=>function(metadata){
        if(metadata.parentRunId){
            this._parentRunId=metadata.parentRunId
            delete metadata.parentRunId
        }
        fx.call(this,...arguments)
     },'addMetadata')
}

function extendRunnable(allNodes, qili, flowise) {
    allNodes.filter(a => !!a.run).forEach(a => {
        //all runnable should be evaluatable, so add evaluators
        

        a.inputs.unshift({
            label: 'Pre Action',
            name: 'preAction',
            type: 'Tool',
            description:"pre action on input, such as stt",
            optional: true
        })

        a.inputs.push({
            label: 'Post Action',
            name: 'postAction',
            type: 'Tool',
            description:"post action on output, such as tts",
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
                monkeyIntercept(chainOrAgent,'call', f2 => async function (input, callbacks) {
                    callbacks=[...callbacks]
                    const runMetadata=exports.extractRunMetadata(options)
                    if(runMetadata){
                        const monitor=new flowise.Monitor(runMetadata)
                        callbacks.unshift(monitor)
                        const customChainHandler=callbacks.find(a=>a.socketIO)
                        if(customChainHandler){
                            const {socketIO, socketIOClientId}=customChainHandler
                            monitor.socketIO={
                                emit(){
                                    socketIO.to(socketIOClientId).emit(...arguments)
                                }
                            }
                        }
                        if(runMetadata.silent){
                            callbacks=callbacks.filter(a=>a.name.indexOf("console")==-1)
                        }
                    }else{
                        throw new Error(`${node.name} called without runtime metadata. quit!`)
                    }

                    if(preAction){
                        const {inputs:{pre, selectedTool, ...inputs}}=preAction.metadata.node
                        const transformed=await preAction.call({...inputs, ...input}, callbacks)
                        input={input:transformed}
                    }

                    const prediction= await f2.call(this, input, {
                        callbacks, //can't set on chainOrAgent, since all run must have it
                        metadata:runMetadata,
                    })

                    const outputKey=Object.keys(prediction)[0]
                    const outputText=prediction[outputKey]

                    if(runMetadata.evaluating && !runMetadata.parentRunId){
                        const evaluator=evaluators.find(a=>a.metadata.node.id==runMetadata.evaluating)
                        const evaluateInput=input.input || input
                        const evaluateResult= await evaluator.evaluate({
                            input:evaluateInput,
                            prediction:outputText,
                        })
                        evaluateResult.input=evaluateInput
                        evaluateResult.output=outputText
                        return {[outputKey]:JSON.stringify(evaluateResult)}
                    }

                    if(postAction){
                        const {inputs:{pre, selectedTool, ...inputs}}=postAction.metadata.node
                        const output=await postAction.call({...inputs, input:outputText}, callbacks)
                        prediction[outputKey]=output
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
            label: "Pre Tool",
            name: "pre",
            type: "Tool",
            optional: true,
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
        monkeyIntercept(a.constructor.prototype, 'init' ,fx => async function ({id,name, inputs},_, options) {
            const langchainNode = await fx.call(this, ...arguments, qili, flowise)
            if(langchainNode.lc_runnable){
                langchainNode.metadata=langchainNode.metadata||{}
                Object.assign(langchainNode.metadata,{
                    node:{
                        id,name,
                        inputs
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

function makeBrowserGraphUtils(flowise) {
    const { constructGraphs, getEndingNode, getStartingNodes } = flowise.Utils
    exports.getEndingNodeId.fx = flowData => {
        try{
            const { nodes, edges } = typeof(flowData)=="string" ? JSON.parse(flowData) : flowData
            const { graph, nodeDependencies } = constructGraphs(nodes, edges)
            return getEndingNode(nodeDependencies, graph)
        }catch(e){
            return null
        }
    }

    exports.getBrowserGraphJS.graphJS = `
        const getEndingNode=${getEndingNode.toString()}
        globalThis.graph={
            constructGraphs:${constructGraphs.toString()},
            getEndingNode:${exports.getEndingNodeId.fx.toString()},
            getStartingNodes:${getStartingNodes.toString()},
            extractNodeGraph: ${exports.extractNodeGraph.toString()},
            overrideGraphInputs: ${exports.overrideGraphInputs.toString()},
            overrideNodeAnchors: ${exports.overrideNodeAnchors.toString()},
        }
        const constructGraphs=globalThis.graph.constructGraphs
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

function clearChatflowPool(flowise) {
    return 
    const EmptyFx = e => false
    flowise.chatflowPool = new Proxy(flowise.chatflowPool, {
        get(target, key) {
            if (typeof (target[key]) == "function")
                return EmptyFx
            return target[key]
        }
    })
}

function extendQiliVectorStore(qili){
    const { TypeORMVectorStore, } = require('langchain/vectorstores/typeorm')

    monkeyIntercept(TypeORMVectorStore, 'fromDataSource', fx=>async function(embeddings, {qili:$qili$, ...dbConfig}){
        if(!$qili$){
            return await fx.call(this, ...arguments)
        }
        const indexName=$qili$.indexName

        const store=await fx.call(this, ...arguments)        
        Object.assign(store.documentEntity.options.columns,{
            indexname:{
                type:String,
            }
        })
        store.appDataSource.buildMetadatas()

        monkeyIntercept(store.appDataSource, 'getRepository', fx=>function(){
            const repo=fx.call(this, ...arguments)
            monkeyIntercept(repo, 'save', save=>async function(chunk){
                chunk.forEach(a=>a.indexname=indexName)
                return await save.call(this, chunk)
            })
            return repo
        })

        monkeyIntercept(store, 'ensureTableInDatabase', fx=>async function(){
            //add author and target
            await fx.call(this, ...arguments)
            await this.appDataSource.query(`
                ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS indexname VARCHAR(255);
            `);
            await this.appDataSource.query(`
                CREATE INDEX IF NOT EXISTS indexname ON ${this.tableName} (indexname);
            `);
        })

        monkeyIntercept(store, 'addVectors', fx=>async function(vectors, documents){
            const urls=Array.from(new Set(documents.map(a=>{
                const url=a.metadata.url
                delete a.metadata.url
                return url
            }))).filter(a=>!!a)

            await fx.call(this, ...arguments)

            if(urls.length){
                urls.forEach(url=>qili.resolver.Document.embedded({},{url},{app:qili}))
                qili.resolver.Document.upsert({},{indexName},{app:qili})
                qili.logger.info(`document[${indexName}] updated with ${urls.length} files.`)
            }
        })
        return store
    })
}

/**
 * use chat history to pass metadata of a single ChatFlow run
 */
const keyRunMetadata="$__RunMetadata__$"
exports.injectRunMetadata=function(runConfig, metadata){
    if(!runConfig.history){
        runConfig.history=[]
    }
    runConfig.history[keyRunMetadata]=metadata
    return runConfig
}
exports.extractRunMetadata=function(runConfig){
    const metadata=runConfig.chatHistory?.[keyRunMetadata]
    if(metadata){
        delete runConfig.chatHistory[keyRunMetadata]
        return metadata
    }
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