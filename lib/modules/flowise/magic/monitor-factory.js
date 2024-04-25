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
            this.monitor = {
                async trackEvent(type, event, data) {
                    const { runId, parentRunId, tokensUsage, extra: { runMonitorSocket: _0, predict: _1, parentRunId: _2, silent: _3, extractNodeGraph: _4, functions: _5, node, ...extra } = {}, ...extraData } = data;
                    qili.emit("predict", { type, event, data });
                    switch (event) {
                        case "start": {
                            me.nodeIndex++
                            const args = ["Run", {
                                _id: runId,
                                parent_run: parentRunId,
                                type,
                                status: "started",
                                ...extraData,
                                ...extra,
                                name: node?.name,
                                node: node ? safe(node) : undefined,
                                author: userId,
                            }];
                            me.push(() => qili.createEntity(...args).then(a => me.track(...args)));

                            break;
                        }
                        case "end": {
                            const args = ["Run", { _id: runId }, {
                                status: "success",
                                tokensUsage,
                                author: userId,
                                ...extraData
                            }];
                            me.push(() => qili.patchEntity(...args).then(a => me.track(...args)));

                            break;
                        }
                        case "error": {
                            const args = ["Run", { _id: runId }, {
                                status: "error",
                                error,
                                author: userId,
                                ...extraData
                            }];
                            me.push(() => qili.patchEntity(...args).then(a => me.track(...args)));
                            break;
                        }
                        case "feedback": {
                            me.push(async () => {
                                const data = await req.app.get1Entity("Run", { _id: runId }, { feedback: 1 });
                                const args = ["Run", { _id: runId }, {
                                    author: userId,
                                    feedback: {
                                        ...(data?.feedback || {}),
                                        ...extra,
                                    },
                                }];
                                return qili.patchEntity(...args).then(a => me.track(...args));
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
                extra: { node: { name: "ChatFlow", inputs: {} } } 
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
                tags,
                runtime: "langchain-js",
                input: query,
            });
        }

        async handleEmbedQueryEnd({ vectors, tokensUsage: { model, ...tokensUsage } }, runId) {
            await this.monitor.trackEvent("embedding", "end", {
                runId,
                model,
                tokensUsage,
                output: `${vectors.length} vectors`
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

        /** lazy to pass */
        track(_, filter, docOrPatch) {
            const doc = { ...filter, ...docOrPatch };
            const { _id, parent_run, status, input, output, node, author } = doc;
            const data = { _id, parent_run, status, input: !!input && clear(input), output: !!output && clear(output), node };
            Object.keys(data).forEach(k => {
                if (!data[k]) {
                    delete data[k];
                }
            });
            this.socketIO?.emit('monitor', data);

            if (status == "success" || status == "error") {//end
                    const cost=qili.resolver.Run.cost(
                        {},
                        { runId: _id, rootRunId: this.rootRunId, chatflowId: this.chatflowId, nodeAmount:this.nodeIndex }, 
                        { app: qili, user: { _id: author } }
                    ).then(cost=>{
                        if (cost) {
                            this.socketIO?.emit('cost', cost);
                        }
                        return cost
                    })
                    this.costs.push(cost)
            }
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