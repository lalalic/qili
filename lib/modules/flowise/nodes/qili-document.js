const { Document } =require( 'langchain/document')
const { TypeORMVectorStore, } =require( 'langchain/vectorstores/typeorm')
const { getBaseClasses }=require("flowise-components/dist/src/utils")
const { Pool } =require( 'pg')

let pool=null, appDataSource=null
class Node{
    async remove(indexName, dbConfig){
        pool = pool || new Pool(dbConfig)
        await pool.query(`delete from documents where indexName= $1 `, [indexName])
    }

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

    async init({ctx, inputs:{document:docs, embeddings, topK, indexName, tableName="documents"}, outputs:{output}={}}, _, options, qili, flowise){
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
            user:ctx.author,
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
            }
        })
        if(!pool){
            pool=new Pool(fields.postgresConnectionOptions)
        }
        
        const indexName=this.indexName=fields.indexName
        this.qili=fields.qili
        this.user=fields.user

        if(!appDataSource){
            appDataSource=this.appDataSource
        }
        
        this.appDataSource=appDataSource
    }

    get pool(){
        return pool
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
        `);
        await this.appDataSource.query(`
            CREATE INDEX IF NOT EXISTS indexname ON ${this.tableName} (indexname);
        `);
        QiliTypeORMVectorStore.ensured=true
    }

    async addDocuments(documents){
        if(documents?.length>0){
            await this.delete() 
        }

        await super.addDocuments(...arguments)
    }

    async addVectors(vectors, documents){
        const urls=Array.from(new Set(documents.map(a=>{
            const url=a.metadata.url
            delete a.metadata.url
            return url
        }))).filter(a=>!!a)

        const indexName=this.indexName
        const qili=this.qili
        
        const rows = vectors.map((embedding, idx) => {
            const embeddingString = `[${embedding.join(",")}]`;
            const documentRow = {
                pageContent: documents[idx].pageContent,
                embedding: embeddingString,
                metadata: {...documents[idx].metadata, url:undefined},
                indexname:indexName
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


        if(urls.length){
            urls.forEach(url=>qili.resolver.Document.embedded({},{url},{app:qili}))
            qili.resolver.Document.upsert({},{indexName},{app:qili})
            qili.logger.info(`document[${indexName}] updated with ${urls.length} files.`)
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

    async delete(){
        await this.qili.resolver.User.deleteDocument({},{id:this.indexName},{app:this.qili, user:{_id:this.user}})
    }
}
module.exports = { nodeClass: Node }
