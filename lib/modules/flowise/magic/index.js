exports.init=async function(flowise, qili){
    const ChatFlow=require('./chatflow')
    const {
        extendFlowise, uploadBuiltin,  
        getBrowserGraphJS, getEndingNodeId
    }=require('./extend-flowise')

    Object.assign(flowise, {getBrowserGraphJS, getEndingNodeId, ChatFlow})

    await flowise.initDatabase()
    /**
     * why can't it be moved to extendFlowise??
     * it need monkey interception on flowise.app.get/use, which are called in flowise.config
     */
    uploadBuiltin(flowise, qili)//hacked use flowise.app.get to intercept handler
    await flowise.config(flowise.socketServer=qili.websocketServer)
    await flowise.extendServerNodes()
    await extendFlowise({ flowise, qili})

    flowise.Monitor=require("./monitor-factory")(flowise,qili) 
}