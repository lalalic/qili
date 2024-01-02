const {nodeClass: ReadFile}=require('flowise-components/dist/nodes/tools/ReadFile/ReadFile')
const { ReadFileTool } = require('langchain/tools')
const QiliFileStore=require('./qili-store')

class Node extends ReadFile{
    constructor(){
        super(...arguments)
        this.inputs=[]
    }
    async init(nodeData, input, options, qili, flowise){
        const ctx=flowise.extractRunMetadata(options)
        const basePath = nodeData.inputs?.basePath
        const store = new QiliFileStore(qili, basePath, {_id:ctx?.author})
        return new ReadFileTool({ store })
    }
}

module.exports={nodeClass:Node}