module.exports=class ChatFlow{
    constructor(props){
        Object.assign(this, this.props=props)
    }

    async predict(question, metadata){       
        this.reset()
        return new Promise(resolve=>{
            const currentConfig={...this.config}
            if(question){
                currentConfig.question=question
            }
            const prediction=this.flowise.processPrediction
            const proxy=new Proxy(this, {
                get(target, key){
                    return target[key]||Reflect.get(target.flowise,key)
                }
            })
            const handleMessage=message=>resolve(message?.output ?? message?.text ?? message)
            try{
                //@@hack, use it identify as a safe run
                require('./extend-flowise').injectRunMetadata(currentConfig,{
                    author:this.user._id, 
                    silent:true,
                    chatflowId:this.id,
                    parentRunId: this.parentRunId,
                    //predict sub chatflows
                    predict:async(chatflowId, config, parentRunId)=>{
                        const chatflow=new ChatFlow({...this.props, parentRunId, id:chatflowId, config:{...currentConfig, ...config}})
                        return await chatflow.predict()
                    },
                    extractNodeGraph:(nodeId)=>require('./extend-flowise').extractNodeGraph(nodeId, this.graph),
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
                })
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
            let result =await this.predict(a.data.inputs.input, {evaluating:a.id})
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
            value: results.find(a=>a.value!=='Y') ? 'N' : 'Y',
            score: Math.ceil(100*results.reduce((score, a)=>score+a.score,0)/results.length)/100,
            results,
        }
    }

    async validateKey(){
        const chatflow=Array.from(arguments).find(a=>!!a.flowData)
        this.flowData=chatflow.flowData
        await this.overrideFlowData(chatflow)
        return true
    }

    async overrideFlowData(chatflow){
        const graph=JSON.parse(this.flowData)

        if(this.config.overrideConfig){
            const {overrideEndingNodeAnchorsGraph, ...patch}=this.config.overrideConfig
            if(overrideEndingNodeAnchorsGraph){
                require('./extend-flowise').overrideNodeAnchors(overrideEndingNodeAnchorsGraph, graph, chatflow.endingNode)
            }
            
            require('./extend-flowise').overrideGraphInputs(patch, graph)
        }

        const user=await this.qili.get1Entity("User",{_id:this.user._id},{autoApplyCredential:1})
        const autoApplyCredential=this.qili.resolver.User.autoApplyCredential(user)
        if(autoApplyCredential){
            //auto appy credentials
            const myCredentials=await this.qili.findEntity("Credential", {author:this.user._id}, {_id:1,credentialName:1, encryptedData:1})
            //const systemCredentials=this.qili.findEntity("Credential", {author:'system'}, {_id:1, credentialName:1, encryptedData:1})
            graph.nodes.forEach(node=>{
                const credentialParam=node.data.inputParams.find(param=>param.type=="credential")
                if(credentialParam && !node.data.credential){
                    const ids=credentialParam.credentialNames.map(name=>myCredentials.find(a=>a.credentialName==name)?._id).filter(a=>!!a)
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