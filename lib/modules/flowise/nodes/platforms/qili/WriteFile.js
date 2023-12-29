const {nodeClass: WriteFile}=require('flowise-components/dist/nodes/tools/WriteFile/WriteFile')
const { WriteFileTool } = require('langchain/tools')
const QiliFileStore=require('./qili-store')

class Node extends WriteFile{
    constructor(){
        super(...arguments)
        this.inputs=[]
    }
    async init(nodeData, input, options, qili, flowise, ctx){
        const basePath = nodeData.inputs?.basePath
        const store = new QiliFileStore(qili, basePath, {_id: ctx?.author})
        return new WriteFileTool({ store })
    }
}

module.exports={nodeClass:Node}