class Node{
    constructor(){
        this.label = 'Folder'
        this.name = 'Folder'
        this.version = 1.0
        this.type = 'Folder'
        this.icon = 'qili-ai.svg'
        this.category = 'Tools'
        this.description = 'organize anything'
        this.baseClasses = ['Folder']
        this.inputs=[]
    }

    init(){
        
    }
}

module.exports={nodeClass:Node}