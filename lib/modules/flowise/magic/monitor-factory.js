const { Qili_Monitor_Name } = require('./constants');

function monitorFactory(flowise, qili) {
    function safe(node) {
        try {
            node.inputs = clear(node.inputs);
            return node;
        } catch (e) {
            qili.logger.error(e.message);
            qili.logger.error(node);
        }
    }

    return class QiliMonitor extends flowise.Handlers.LLMonitor {
        constructor({ author: userId, chatflowId, runMonitorSocket, rootRunId }) {
            super();
            const me = this;
            this.chatflowId = chatflowId;
            this.rootRunId = rootRunId || require('uuid').v4();
            this.name = Qili_Monitor_Name;
            this.queue = Promise.resolve();
            this.nodeIndex = 0
            this.socketIO = {
                emit() {
                    flowise.socketServer.to(runMonitorSocket).emit(...arguments);
                }
            };
            this.costs=[]
            const context={ app: qili, user: { _id: userId } }

            this.monitor = {
                async trackEvent(type, event, data) {
                    const { 
                        runId, parentRunId, tokensUsage,
                        error, 
                        extra: { runMonitorSocket: _0, predict: _1, parentRunId: _2, silent: _3, extractNodeGraph: _4, functions: _5, node, ...extra } = {}, 
                        cost,//tool end might send
                        ...extraData } = data;
                    const uname=node?.inputs.uname||node?.inputs.name||node?.id
                    const emitData={ type, event, data}
                    if(uname){
                        emitData.uname=uname
                    }
                    node && safe(node)
                    qili.emit("predict", emitData);
                    switch (event) {
                        case "start": {
                            me.nodeIndex++
                            me.push(() =>{
                                const info={ _id:runId, parent_run:parentRunId, status:"started"}
                                if(node){
                                    me.socketIO.emit('monitor', {...info, node: node.id})
                                }
                                return qili.createEntity("Run", {
                                    ...info,
                                    uname,
                                    name: node?.name,
                                    type,
                                    ...extraData,
                                    ...extra,
                                    author: userId,
                                    node,
                                })
                            });

                            break;
                        }
                        case "end": {
                            me.push(() =>{
                                me.socketIO.emit('monitor', { _id:runId, status:"success"})
                                return qili.patchEntity("Run", { _id: runId }, {
                                    status: "success",
                                    tokensUsage,
                                    author: userId,
                                    ...extraData
                                }).then(a =>{
                                    const info={ runId, rootRunId: me.rootRunId, chatflowId: me.chatflowId, nodeAmount:me.nodeIndex, possibleToolCost:cost}
                                    qili.resolver.Run.cost({}, info, context)
                                    .then(cost=>{
                                        if (cost) {
                                            me.costs.push(cost)
                                            me.socketIO?.emit('cost', cost);
                                        }
                                    })
                                    
                                })
                            });

                            break;
                        }
                        case "error": {
                            me.push(() =>{
                                me.socketIO.emit('monitor', { _id:runId, status:"error"})
                                return qili.patchEntity("Run", { _id: runId }, {
                                    status: "error",
                                    error,
                                    author: userId,
                                    ...extraData
                                })
                            });
                            break;
                        }
                        case "feedback": {
                            me.push(async () => {
                                me.socketIO.emit('monitor', { _id:runId, status:"feedback"})
                                const data = await req.app.get1Entity("Run", { _id: runId }, { feedback: 1 });
                                return qili.patchEntity("Run", { _id: runId }, {
                                    author: userId,
                                    feedback: {
                                        ...(data?.feedback || {}),
                                        ...extra,
                                    },
                                })
                            });
                            break;
                        }
                    }
                }
            };

            this.clone = props => new this.constructor({ ...arguments[0], ...props });
        }

        async start(type, runId=this.rootRunId) {
            await this.monitor.trackEvent(type, 'start', { 
                runId, 
                extra: { chatflow: this.chatflowId, node: { name: "ChatFlow", inputs: {} } } 
            });
        }

        async end(type, runId=this.rootRunId) {
            await this.monitor.trackEvent(type, 'end', { 
                runId, 
            });
            await this.queue
            const totalCost=await this.cost
            qili.patchEntity("Run", {_id: runId}, {totalCost})
            this.socketIO?.emit('done',{totalCost});
        }

        async push(job) {
            this.queue = this.queue.then(async () => {
                try {
                    await job();
                } catch (e) {
                    qili.logger.error(e.message);
                }
            });
        }

        //enhance for cost in tags['cost:10']
        async handleToolEnd(output, runId, parentRunId, tags) {
            //extract cost
            const possibleToolCost=(()=>{
                if(tags){
                    const i=tags.findIndex(a=>!!a && a.startsWith("cost:"))
                    if(i!=-1){
                        const [cost_]=tags.splice(i,1)
                        return parseInt(cost_.split(":")[1])
                    }
                }
            })();
            await this.monitor.trackEvent("tool", "end", {
                runId,
                output,
                cost: possibleToolCost
            });
        }

        async handleRetrieverStart(retriever, query, runId, parentRunId, tags, metadata) {
            await this.monitor.trackEvent("retriever", "start", {
                runId,
                parentRunId,
                extra: metadata,
                tags,
                runtime: "langchain-js",
                input: query,
            });
        }

        async handleRetrieverEnd(documents, runId) {
            await this.monitor.trackEvent("retriever", "end", {
                runId,
                output: `${documents.length} documents`
            });
        }

        async handleRetrieverError(error, runId) {
            await this.monitor.trackEvent("retriever", "error", {
                runId,
                error
            });
        }

        async handleEmbedQueryStart(query, runId, parentRunId, tags, metadata) {
            await this.monitor.trackEvent("embedding", "start", {
                runId,
                parentRunId,
                extra: metadata,
                runtime: "langchain-js",
                //input: query?.input,
            });
        }

        async handleEmbedQueryEnd({ model, usage }, runId) {
            await this.monitor.trackEvent("embedding", "end", {
                runId,
                model,
                tokensUsage:{prompt:usage?.prompt_tokens??0, completion:0},
                output: `some vectors`
            });
        }

        async handleEmbedQueryError(error, runId) {
            await this.monitor.trackEvent("embedding", "error", {
                runId,
                error
            });
        }

        async handleChatModelStart(llm, baseMessages, _runId, _parentRunId, extraParams){
            let messageTransformer=null
            if(messageTransformer=this.getVisionContentTransformer(llm, extraParams)){
                baseMessages.forEach(messages=>{
                    messages.forEach(message=>{
                        if(message._getType()=="human"){
                            message.content=this.parseMarkdown(message.content, messageTransformer)
                        }else{
                            message.content=[messageTransformer(message.content)]
                        }
                    })
                })
            }
            super.handleChatModelStart(...arguments)
        }

        getVisionContentTransformer(llm){
            return flowise.VisionModels?.[llm.kwargs?.model||llm.kwargs?.model_name]
        }

        parseMarkdown(content, messageTransformer){
            const info=[...content.matchAll(/\!\[(?<title>.*?)\]\((?<url>.*?)\)/g), null].reduce((data, matched)=>{
                if(!matched){//last
                    const message=messageTransformer(content.substring(data.i))
                    message && data.content.push(message)
                    return data
                }
                const [whole]=matched
                const {index, groups:{title, url}}=matched
                let message=messageTransformer(content.substring(data.i, index))
                message && data.content.push(message)
                message=messageTransformer(url, title)
                message && data.content.push(message)
                data.i=index+whole.length
                return data
            },{content:[], i:0})

            return info.content
        }

        get cost(){
            return Promise.all(this.costs)
                .then(costs=>costs.filter(a=>!!a).reduce((total,a)=>a.total+total,0))
        }
    };
};

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

module.exports=monitorFactory