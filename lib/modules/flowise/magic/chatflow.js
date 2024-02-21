module.exports=class ChatFlow{
    constructor(props){
        Object.assign(this, this.props=props)
    }

    async predict(question, metadata, config){       
        this.reset()
        return new Promise((resolve, reject)=>{
            const currentConfig={...this.config, ...config}
            if(question){
                currentConfig.question=question
            }
            const prediction=this.flowise[require('./constants').Flowise_Prediction_Function]
            const proxy=new Proxy(this, {
                get(target, key){
                    return target[key]||Reflect.get(target.flowise,key)
                }
            })
            const handleMessage=message=>{
                resolve(message?.output ?? message?.text ?? message)
            }
            try{
                //@@hack, use it identify as a safe run
                require('./extend-flowise').injectRunMetadata(currentConfig,{
                    ...this.ctx,
                    monitor:this.monitor,
                    silent:true,
                    //predict sub chatflows
                    predict:async(chatflowId, nodeId, config, parentRunId)=>{
                        const chatflow=new ChatFlow({
                            ...this.props, 
                            id:chatflowId, 
                            parentRunId,
                            config:{...currentConfig, ...config},
                            monitor:this.monitor.clone({chatflowId, rootRunId:parentRunId})
                        })
                        chatflow.overrideEndingNodeAnchorsGraph=require('./extend-flowise').extractNodeGraph(nodeId, this.graph)
                        return await chatflow.predict()
                    },
                    ...metadata
                })
                
                prediction.call(proxy,{
                    params:{id:this.id},
                    body:currentConfig,
                    files:[],
                },{
                    json:handleMessage,
                    status(){
                        return {
                            send:handleMessage
                        }
                    }
                }, this.flowise.socketServer)
            }catch(e){
                reject(e)
            }
        })
    }

    async evaluate(){
        const EvaluatorIDReg=/\{\{(?<id>.*)\.data\.instance/
        const chatflow=await this.qili.get1Entity("ChatFlow",{_id:this.id})
        const flowData=JSON.parse(chatflow.flowData)
        const target=flowData.nodes.find(a=>a.id==chatflow.endingNode)
        const {evaluators}=target.data.inputs
        const evaluatorNodes=evaluators.map(a=>{
            const matched=a.match(EvaluatorIDReg)
            return flowData.nodes.find(b=>b.id==matched?.groups?.id)
        }).filter(a=>!!a.data.inputs.input)

        const results=[]
        for(const a of evaluatorNodes){
            const {input, overrideConfig}=a.data.inputs
            /*
            const chatflow=this.clone({config:{question:input, overrideConfig:JSON.parse(overrideConfig||'{}')}})
            const prediction=await chatflow.predict()
            const evaluator=prediction.evaluators.find(evaluator=>evaluator.id==a.id)
            const result=await evaluator.evaluate({input, prediction,})
            */
            
            let result =await this.predict(
                input, 
                {evaluating:a.id}, 
                {
                    overrideConfig:JSON.parse(overrideConfig||'{}')
                } 
            )
            
            try{
                result=JSON.parse(result)
            }catch(e){
                result={
                    value:"N",
                    score:0,
                    reasoning: `Predict Error: ${result}`,
                }
            }
            results.push(result)
        }


        return {
            value: results.find(a=>a.value=='N' || a.value.indexOf(' N')!=-1) ? 'N' : 'Y',
            score: Math.ceil(100*results.reduce((score, a)=>score+a.score,0)/results.length)/100,
            results,
        }
    }

    /**
     * it's called from flowise
     * @returns 
     */
    async validateKey(){
        const chatflow=Array.from(arguments).find(a=>!!a.flowData)
        this.flowData=chatflow.flowData
        await this.overrideFlowData(chatflow)
        return true
    }

    get ctx(){
        return Object.freeze({
            author:this.user._id, 
            chatflowId:this.id,
            parentRunId: this.parentRunId,
            runMonitorSocket: this.config.runMonitorSocket,
        })
    }

    async overrideFlowData(chatflow){
        const graph=JSON.parse(this.flowData)
        if(this.overrideEndingNodeAnchorsGraph){
            require('./extend-flowise').overrideNodeAnchors(this.overrideEndingNodeAnchorsGraph, graph, chatflow.endingNode)
        }
        
        if(this.config.overrideConfig){
            require('./extend-flowise').overrideGraphInputs(this.config.overrideConfig, graph)
        }

        const user=await this.qili.get1Entity("User",{_id:this.user._id},{autoApplyCredential:1})
        const autoApplyCredential=this.qili.resolver.User.autoApplyCredential(user)
        if(autoApplyCredential){
            //auto appy credentials
            const availableCredentials=[
                ...(await this.qili.findEntity("Credential", {author:this.user._id}, {_id:1,credentialName:1, encryptedData:1})),
                ...(await this.qili.findEntity("Credential", {author:this.flowise.SYSTEM}, {_id:1, credentialName:1, encryptedData:1}))
            ]

            graph.nodes.forEach(node=>{
                const credentialParam=node.data.inputParams.find(param=>param.type=="credential")
                if(credentialParam && !node.data.credential){
                    const ids=credentialParam.credentialNames.map(name=>availableCredentials.find(a=>a.credentialName==name)?._id).filter(a=>!!a)
                    switch(ids.length){
                        case 1:
                            node.data.credential=ids[0]
                        break
                        case 2:
                            node.data.credential=ids
                        break
                    }
                }
            })
        }

        //remove any documents already embedded by checking file
        //vectorStore need {author, target}
        /**
         * qili-document and its loader help to manage knowledge
         * overrideConfig: 
         *      indexName, and file are specially used for this purpose
         * 2 cases:
         * > manage knowledge: indexName and file should show together
         * > use knowledge: only indexName should show, original file should be clear.
         * > no override at all: then 
         * 
         */
        const files=graph.nodes.filter(a=>a.data.name=="anyFile")
        for (let i=0;i<files.length;i++){
            const anyFile=files[i]
            const document=targetOf(anyFile, graph)
            if(document?.data.inputs.embeddings){
                if(document.data.name=="qiliUpsert"){
                    if(this.config.overrideConfig?.indexName){
                        document.data.inputs.indexName=this.config.overrideConfig.indexName
                        delete this.config.overrideConfig.indexName

                        if(!this.config.overrideConfig.file){//use knowledge 
                            anyFile.data.inputs.file=""
                        }else{//manage knowledge
                            anyFile.data.inputs.file=this.config.overrideConfig.file
                            delete this.config.overrideConfig.file
                        }
                    }

                    if(!document.data.inputs.indexName){
                        document.data.inputs.indexName=`ChatFlow:${chatflow.id}:${document.data.id}`
                    }

                    const {indexName}=document.data.inputs
                    const {file}=anyFile.data.inputs
                    if(file){
                        const urls=await this.qili.resolver.Document.patch({},{indexName, file}, {app:this.app, user})
                        anyFile.data.inputs.file=urls.filter(a=>!!a).join(",").trim()
                    }
                }
            }
        }

        chatflow.flowData=JSON.stringify(graph)
        delete this.config.overrideConfig
    }

    get graph(){
        if(!this._graph){
            if(this.flowData){
                this._graph=JSON.parse(this.flowData)
            }
        }
        return this._graph
    }

    get chatflowPool(){
        if(!this._chatflowPool){
            const ChatFlowPool=this.flowise.chatflowPool.constructor
            this._chatflowPool=new ChatFlowPool()
        }
        return this._chatflowPool
    }

    reset(){
        delete this.flowData
        delete this._graph
        delete this._chatflowPool
    }


    async build(){
        /*get all ChatFlows, Tools, Credentials, Nodes*/
        const chatflows=[this.id], tools=[], credentials=[], nodes=[]
        const database={ChatFlow:[], Tool:[], Credential:[]}

        let i=0
        while(chatflows.length>i){
            const chatflow=await this.qili.get1Entity("ChatFlow",{_id:chatflows[i++]})
            database.ChatFlow.push(chatflow)
            try{
                JSON.parse(chatflow.flowData,function(key, value){
                    switch(key){
                        case "credential":
                            value && !credentials.includes(value) && credentials.push(value)
                        break
                        case "selectedChatflow":
                            value && !chatflows.includes(value) && chatflows.push(value)
                        break
                        case "selectedTool":
                            value && !tools.includes(value) && tools.push(value)
                        break
                        case "data":
                            value.name && !nodes.includes(value.name) && nodes.push(value.name)
                        break
                    }
                    return value
                })
            }catch(e){
                console.error(e.message)
            }
            ;(await Promise.all(tools.map(a=>this.qili.get1Entity("Tool",{_id:a}))))
                .forEach(a=>a && database.Tool.push(a))
            tools.splice(0,tools.length)

            ;(await Promise.all(credentials.map(a=>this.qili.get1Entity("Credential",{_id:a}))))
                .forEach(a=>a && database.Credential.push(a))
            credentials.splice(0,credentials.length)
        }

        if(database.Credential.length){
            await Promise.all(
                database.Credential.map(async a=>{
                    a.plainDataObj=await this.flowise.Utils.decryptCredentialData(a.encryptedData)
                })
            )
        }

        /*generateDependencies()*/
        return `
            module.exports=${JSON.stringify(database)};
            //used nodes: ${nodes.join(",")}
            //require all of them
            ${nodes.map(a=>`require("${this.flowise.nodesPool.componentNodes[a].filePath}")`).join("\n")}
        `


        
    }
}


function targetOf(node, graph){
    const edge=graph.edges.find(edge=>edge.source==node.id)
    if(edge)
        return graph.nodes.find(node=>node.id==edge.target)
}
