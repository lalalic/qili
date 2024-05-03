
const {nodeClass:Switch}=require("./Switch")
class Node extends Switch{
    constructor(){
        super(...arguments)
        this.label="Switch Agent"
        this.name = 'SwitchAgent'
        this.type = 'AgentExecutor'
        this.category = 'Agents'
        this.description="It allows to control use agent or directly call a chain in a graph"
        this.baseClasses = [this.type]
    }

    async init(node, request, options, qili, flowise){
        const executor=await super.init(...arguments)
        executor.metadata.passThrough={qili, flowise}
        return executor
    }

    async run(node, request, options){
        const selected=node.instance
        const {qili, flowise}=selected.metadata.passThrough
        delete selected.metadata.passThrough
        const {node: nodeData}=selected.metadata
        const NodeClass=flowise.nodesPool.componentNodes[nodeData.name].constructor
        const nodeInstance=new NodeClass()
        return await nodeInstance.run({...nodeData, instance:selected}, request, options, qili, flowise)
    }
}

module.exports={nodeClass:Node}