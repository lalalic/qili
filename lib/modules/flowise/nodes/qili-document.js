const { Document } =require( 'langchain/document')
const { TypeORMVectorStore, } =require( 'langchain/vectorstores/typeorm')
const { getBaseClasses }=require("flowise-components/dist/src/utils")
const { Pool } =require( 'pg')

let appDataSource=null
class Node{
    constructor() {
        this.label = 'Qili Document Store'
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
            indexName, 
            qili,
            user:flowise.extractRunMetadata(options).author,
            pool: flowise.documentServer,
        }

        const flattenDocs = (docs||[]).flat()
        const finalDocs = flattenDocs.map(doc=>new Document(doc))

        const vectorStore = await QiliTypeORMVectorStore.fromDocuments(finalDocs, embeddings, args)

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

/**
 * initialize once
 * ensure once
 */
class QiliTypeORMVectorStore extends TypeORMVectorStore{
    constructor(embeddings, fields){
        super(...arguments)
        Object.assign(this.documentEntity.options.columns,{
            indexname:{
                type:String,
            },
            author:{
                type:String,
            }
        })
        this.pool=fields.pool
        
        this.qili=fields.qili
        this.user=fields.user
        this.indexName=fields.indexName
        this.tableName=fields.tableName

        if(!appDataSource){
            appDataSource=this.appDataSource
        }
        
        this.appDataSource=appDataSource
    }

    get appDataSource(){
        return appDataSource
    }

    async ensureTableInDatabase() {
        if(QiliTypeORMVectorStore.ensured)
            return 
        await super.ensureTableInDatabase(...arguments)
        await this.appDataSource.query(`
            ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS indexname VARCHAR(255);
            ALTER TABLE ${this.tableName} ADD COLUMN IF NOT EXISTS author VARCHAR(255);
        `);
        await this.appDataSource.query(`
            CREATE INDEX IF NOT EXISTS indexname ON ${this.tableName} (indexname);
            CREATE INDEX IF NOT EXISTS author ON ${this.tableName} (author);
        `);
        QiliTypeORMVectorStore.ensured=true
    }

    async addVectors(vectors, documents){
        const rows = vectors.map((embedding, idx) => {
            const embeddingString = `[${embedding.join(",")}]`;
            const documentRow = {
                pageContent: documents[idx].pageContent,
                embedding: embeddingString,
                metadata: {...documents[idx].metadata},
                indexname:this.indexName,
                author: this.user,
            };
            return documentRow;
        });
        const documentRepository = this.appDataSource.getRepository(this.documentEntity);
        const chunkSize = 500;
        for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            try {
                await documentRepository.save(chunk);
            }
            catch (e) {
                console.error(e);
                throw new Error(`Error inserting: ${chunk[0].pageContent}`);
            }
        }
    }

    async similaritySearchVectorWithScore(query, k, filter){
        const embeddingString = `[${query.join(',')}]`
        const _filter = filter ?? '{}'

        const queryString = `
            SELECT *, embedding <=> $1 as "_distance"
            FROM ${this.tableName}
            WHERE indexName=$4 and metadata @> $2
            ORDER BY "_distance" ASC
            LIMIT $3;`

        const documents = await this.pool.query(queryString, [embeddingString, _filter, k, this.indexName])
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

    static async fromDocuments(docs, embeddings, fields){
        const store = new QiliTypeORMVectorStore(embeddings, fields);
        if (!store.appDataSource.isInitialized) {
            await store.appDataSource.initialize();
        }
        await store.addDocuments(docs);
        return store;
    }
}
module.exports = { nodeClass: Node }
