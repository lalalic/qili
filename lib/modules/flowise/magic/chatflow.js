module.exports=class ChatFlow{
    constructor(props){
        Object.assign(this, this.props=props)
    }

    async predict(){        
        return new Promise(resolve=>{
            const prediction=this.flowise.processPrediction
            const proxy=new Proxy(this, {
                get(target, key){
                    return target[key]||Reflect.get(target.flowise,key)
                }
            })
            //@@hack, use it identify as a safe run
            require('./extend-flowise').injectRunMetadata(this.config,{
                author:this.user._id, 
                silent:true,
                chatflowId:this.id,
                parentRunId: this.parentRunId,
                predict:async(chatflowId, config, parentRunId)=>{
                    const chatflow=new ChatFlow({...this.props, parentRunId, id:chatflowId, config:{...this.config, ...config}})
                    return await chatflow.predict()
                },
                extractNodeGraph:(nodeId)=>require('./extend-flowise').extractNodeGraph(nodeId, this.graph)
            })

            prediction.call(proxy,{
                params:{id:this.id},
                body:this.config,
                files:[],
            },{
                json:resolve,
                status(){
                    return {
                        send(message){
                            resolve(message)
                        }
                    }
                }
            })
        })
    }

    async validateKey(req, chatflow){
        this.flowData=chatflow.flowData
        if(this.config.overrideConfig){
            const {overrideEndingNodeAnchorsGraph, ...patch}=this.config.overrideConfig
            const graph=JSON.parse(this.flowData)
            if(overrideEndingNodeAnchorsGraph){
                require('./extend-flowise').overrideNodeAnchors(overrideEndingNodeAnchorsGraph, graph, chatflow.endingNode)
            }
            
            require('./extend-flowise').overrideGraphInputs(patch, graph)
            
            chatflow.flowData=JSON.stringify(graph)
            delete this.config.overrideConfig
        }
        return true
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


    async build(){
        /*get all ChatFlows, Tools, Credentials, Nodes*/
        const chatflows=[this.id], tools=[], credentials=[], nodes=[]
        const database={ChatFlow:[], Tool:[], Credential:[]}

        let i=0
        while(chatflows.length>i){
            const chatflow=await this.qili.get1Entity("ChatFlow",{_id:chatflows[i++]})
            database.ChatFlow.push(chatflow)
            JSON.parse(chatflow.flowData,function(key, value){
                switch(key){
                    case "credential":
                        !credentials.includes(value) && credentials.push(value)
                    break
                    case "selectedChatflow":
                        !chatflows.include(value) && chatflows.push(value)
                    break
                    case "selectedTool":
                    case "pre":
                        !tools.includes(value) && tools.push(value)
                    break
                    case "data":
                        !nodes.includes(value.name) && nodes.push(value.name)
                    break
                }
                return value
            })

            await Promise.all(tools.map(a=>this.qili.get1Entity("Tool",{_id:a})))
            tools.splice(0,tools.length)
            await Promise.all(credentials.map(a=>this.qili.get1Entity("Credential",{_id:a})))
            credentials.splice(0,credentials.length)
        }

        /*generateDependencies()*/
        return `
            module.exports=${JSON.stringify(database)};
            //used nodes: ${nodes.join(",")}
            //require all of them
            ${nodes.map(a=>`require("${this.flowise.nodesPool[a].filePath}")`).join("\n")}
        `
    }
}