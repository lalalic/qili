exports.run=function(){
    const {App:Flowise}=require("flowise")
    Flowise.prototype.extendServerNodes=function(){return exports.extendServerNodes(this)}
    Flowise.prototype.Utils=require("flowise/dist/utils")
    Flowise.prototype.Handlers=require("flowise-components/dist/src/handler")
    Flowise.prototype.Handlers.LLMonitor=require('langchain/callbacks/handlers/llmonitor').LLMonitorHandler
    const flowise=new Flowise()
    require('../magic').init(flowise, {})
}

exports.extendServerNodes=function extendServerNodes(flowise){
    return new Promise((resolve,reject)=>{
        let timer=setInterval(async ()=>{
            if(flowise.cachePool){
                clearInterval(timer)
                timeout && clearTimeout(timeout)
                //hack to load extra nodes
                try{

                    const files=await require('fs/promises').readdir(`${__dirname}/nodes`)
                    const nodes=(await Promise.all(
                        files.filter(a=>a.endsWith(".js")).map(a=>{
                            const filePath=`${__dirname}/nodes/${a}`
                            return import(filePath).then(m=>{
                                if(m?.nodeClass){
                                    const node=new m.nodeClass()
                                    node.filePath=filePath
                                    flowise.nodesPool.componentNodes[node.name]=node
                                    return node.name
                                }
                            }).catch(e=>{
                                console.error(`loading[${a}]: ${e.message}`)
                            })
                        })
                    )).filter(a=>!!a)

                    console.log(`${nodes.length} extended nodes: ${nodes.join(",")}`)
                    

                    resolve()
                }catch(e){
                    console.error(e.message)
                    reject(e.message)
                }
            }
        },100)
        const timeout=setTimeout(()=>{
            clearInterval(timer)
            console.log('timeout')
            resolve()
            //reject('timeout')
        }, 60000)
    })
}