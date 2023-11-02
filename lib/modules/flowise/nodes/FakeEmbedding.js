const {SyntheticEmbeddings}=require("langchain/embeddings/fake")
const { getBaseClasses } =require("flowise-components/dist/src/utils")
class FakeEmbeddingNode{
    constructor(){
        this.label = 'Fake Embeddings'
        this.name = 'fakeEmbeddings'
        this.version = 1.0
        this.type = 'FakeEmbeddings'
        this.icon = `${__dirname}/bug.svg`
        this.category = 'Embeddings'
        this.description = 'A fake embeddings for test'
        this.baseClasses = [this.type, ...getBaseClasses(SyntheticEmbeddings)]
        // this.credential = {}
        // this.inputs = []
    }

    async init(nodeData, _, options){
        return new SyntheticEmbeddings({})
    }
}

module.exports={nodeClass:FakeEmbeddingNode}