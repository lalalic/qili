const { Document } =require( 'langchain/document')
const { TypeORMVectorStore, } =require( 'langchain/vectorstores/typeorm')
const { getBaseClasses }=require("flowise-components/dist/src/utils")
const { Pool } =require( 'pg')

class Node{
    async remove(indexName, dbConfig){
        const pool = new Pool(dbConfig)
        const conn = await pool.connect()
        await conn.query(`delete from documents where indexName= $1 `, [indexName])
    }

    constructor() {
        this.label = 'Qili Document'
        this.name = 'qiliUpsert'
        this.version = 1.0
        this.type = 'QiliPostgres'
        this.icon = 'qili-ai.svg'
        this.category = 'Vector Stores'
        this.description = 'Upsert documents to Qili'
        this.baseClasses = [this.type, 'VectorStoreRetriever', 'BaseRetriever']
        
        this.inputs = [
            {
                label: 'Document',
                name: 'document',
                type: 'Document',
                list: true
            },
            {
                label: 'Embeddings',
                name: 'embeddings',
                type: 'Embeddings'
            },
            {
                label: 'Document Name',
                name: 'indexName',
                type: 'string',
                optional: true
            },
            {
                label: 'Top K',
                name: 'topK',
                description: 'Number of top results to fetch. Default to 4',
                placeholder: '4',
                type: 'number',
                additionalParams: true,
                optional: true
            }
        ]
        this.outputs = [
            {
                label: 'Retriever',
                name: 'retriever',
                baseClasses: this.baseClasses
            },
            {
                label: 'Vector Store',
                name: 'vectorStore',
                baseClasses: [this.type, ...getBaseClasses(TypeORMVectorStore)]
            }
        ]
    }

    async init({inputs:{document:docs, embeddings, topK, indexName, tableName="documents"}, outputs:{output}={}}, _, options, qili, flowise){
        const dbConfig={...flowise.embeddingDbConfig}
        const k = topK ? parseFloat(topK) : 4
        const args = {
            postgresConnectionOptions: {
                type: 'postgres',
                ...dbConfig,
                username: dbConfig.user,
            },
            tableName,
            qili:{indexName},
        }

        const flattenDocs = (docs||[]).flat()
        const finalDocs = flattenDocs.map(doc=>new Document(doc))

        const vectorStore = await TypeORMVectorStore.fromDocuments(finalDocs, embeddings, args)

        // Rewrite the method to use pg pool connection instead of the default connection
        /* Otherwise a connection error is displayed when the chain tries to execute the function
            [chain/start] [1:chain:ConversationalRetrievalQAChain] Entering Chain run with input: { "question": "what the document is about", "chat_history": [] }
            [retriever/start] [1:chain:ConversationalRetrievalQAChain > 2:retriever:VectorStoreRetriever] Entering Retriever run with input: { "query": "what the document is about" }
            [ERROR]: uncaughtException:  Illegal invocation TypeError: Illegal invocation at Socket.ref (node:net:1524:18) at Connection.ref (.../node_modules/pg/lib/connection.js:183:17) at Client.ref (.../node_modules/pg/lib/client.js:591:21) at BoundPool._pulseQueue (/node_modules/pg-pool/index.js:148:28) at .../node_modules/pg-pool/index.js:184:37 at process.processTicksAndRejections (node:internal/process/task_queues:77:11)
        */
        vectorStore.similaritySearchVectorWithScore = async (query, k, filter) => {
            const embeddingString = `[${query.join(',')}]`
            const _filter = filter ?? '{}'

            const queryString = `
                SELECT *, embedding <=> $1 as "_distance"
                FROM ${tableName}
                WHERE indexName=$4 and metadata @> $2
                ORDER BY "_distance" ASC
                LIMIT $3;`

            const pool = new Pool(dbConfig)
            const conn = await pool.connect()

            const documents = await conn.query(queryString, [embeddingString, _filter, k, indexName])

            conn.release()

            const results = []
            for (const doc of documents.rows) {
                if (doc._distance != null && doc.pageContent != null) {
                    const document = new Document(doc)
                    document.id = doc.id
                    results.push([document, doc._distance])
                }
            }

            return results
        }

        if (output === 'retriever') {
            const retriever = vectorStore.asRetriever(k)
            return retriever
        } else if (output === 'vectorStore') {
            vectorStore.k = k
            return vectorStore
        }
        return vectorStore
    }
}

module.exports = { nodeClass: Node }
