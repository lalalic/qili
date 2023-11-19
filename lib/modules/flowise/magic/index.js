exports.init=async function(flowise, qili){
    const ChatFlow=require('./chatflow')
    const {
        extendFlowise, uploadBuiltin, monitorFactory, 
        getBrowserGraphJS, getEndingNodeId
    }=require('./extend-flowise')
    Object.assign(flowise, {getBrowserGraphJS, getEndingNodeId, ChatFlow})

    
    await flowise.initDatabase()
    uploadBuiltin(flowise, qili)//hacked use flowise.app.get to intercept handler
    await flowise.config(
        (()=>{
            return qili?.createSocketServer({
                path:'/socket.io',
                cors:{origin:'*'}
            })
        })()
    )
    await flowise.extendServerNodes()
    await extendFlowise({ flowise, qili})

    flowise.Monitor=monitorFactory(flowise,qili) 
}