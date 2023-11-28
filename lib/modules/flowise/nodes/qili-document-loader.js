class Node{
    constructor() {
        this.label = 'Qili Document'
        this.name = 'anyFile'
        this.version = 1.0
        this.type = 'Document'
        this.icon = 'file-smile.svg'
        this.category = 'Document Loaders'
        this.description = `Load data from files`
        this.baseClasses = [this.type]
        this.inputs = [
            {
                label: 'File',
                name: 'file',
                type: 'file',
                fileType: '.*'
            },
            {
                label: 'Text Splitter',
                name: 'textSplitter',
                type: 'TextSplitter',
                optional: true
            },
            {
                label: 'Usage',
                name: 'usage',
                type: 'options',
                options: [
                    {
                        label: 'One document per page',
                        name: 'perPage'
                    },
                    {
                        label: 'One document per file',
                        name: 'perFile'
                    }
                ],
                default: 'perPage'
            },
            {
                label: 'Metadata',
                name: 'metadata',
                type: 'json',
                optional: true,
                additionalParams: true
            }
        ]
    }
    async init({inputs:{file, metadata, ...inputs}, outputs={}}, _, options, qili, flowise){
        const allDocumentFileLoaders=Object.values(flowise.nodesPool.componentNodes).filter(a=>a.category=="Document Loaders")
        const docs=await Promise.all(
            file.split(",").map(async url=>{
                let [ext]=url.split(".").reverse()
                ext='.'+ext
                let param
                const loader=allDocumentFileLoaders.find(a=>param=a.inputs.find(b=>b.type=="file" && b.fileType==ext))
                if(!loader){
                    return 
                }

                if(Array.isArray(loader.outputs) &&  loader.outputs.length>1){
                    outputs.output=loader.outputs[0].name
                }
                
                const docs=await loader.init({inputs:{...inputs, [param.name]:await fetchBase64(url)}, outputs})
                docs.forEach(doc=>Object.assign(doc.metadata,{url,...metadata}))
                return docs
            })
        )
        const all=docs.flat().filter(a=>!!a)
        return all
    }
}

async function fetchBase64(url){
    const fetch=require('node-fetch2')
    const res=await fetch(url)
    const [fileName]=url.split("?")[0].split("/").reverse()
    const base64Data = Buffer.from(await res.arrayBuffer(), 'binary').toString('base64');
    const dataURI = `data:${res.headers.get('content-type')||'*/*'};base64,${base64Data},filename:${fileName}`;
    return dataURI
}
module.exports={nodeClass: Node}