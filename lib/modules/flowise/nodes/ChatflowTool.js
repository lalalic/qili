const { DynamicTool } =require( 'langchain/tools')
const { getBaseClasses }=require("flowise-components/dist/src/utils")
class ChatflowToolNode{
    constructor(){
        this.label = 'Chatflow Tool'
        this.name = 'chatflowTool'
        this.type = 'ChatflowTool'
        this.category = "Tools"
        this.version = "1.0"
        this.icon = `${__dirname}/customtool.svg`
        this.description = `Use chatflow you've created in Flowise`
        this.baseClasses = [this.type, ...getBaseClasses(ChatflowTool)]
        this.inputs = [
            {
                label: 'Select Chatflow',
                name: 'selectedChatflow',
                type: 'asyncOptions',
                loadMethod: 'listChatflows'
            },
            {
                label: 'Tool Description',
                name: 'description',
                type: 'string',
                rows: 3,
                placeholder:'A description for this chatflow'
            },
        ]

        this.loadMethods = {
            async listChatflows(nodeData, {appDataSource, databaseEntities}){
                const chatflows=await appDataSource.getRepository(databaseEntities['ChatFlow']).find()
                return chatflows.map(({name, id, description})=>({label:name, name:id, description}))
            }
        }
    }

    async init({inputs:{selectedChatflow, description}}, _, {appDataSource, databaseEntities}){
        const chatflow = await appDataSource.getRepository(databaseEntities['ChatFlow']).findOneBy({
            id: selectedChatflow
        })

        if (!chatflow) throw new Error(`ChatFlow[${selectedChatflow}] not found`)
        
        return new ChatflowTool({
            name:chatflow.name,
            description: description||chatflow.description, 
            schema: chatflow.schema,
            chatflow,
        })
    }
}

class ChatflowTool extends DynamicTool{
    constructor({chatflow, ...rest}){
        super({
            ...rest,
            func(input, runManager){
                const ret=chatflow.run(input, runManager?.getChild())
                return ret.message
            }
        })
    }
}

module.exports={nodeClass:ChatflowToolNode}