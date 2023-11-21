class Node{
    constructor() {
        this.label = 'Any File'
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
    async init({inputs:{file, ...inputs}}, _, options, qili, flowise){
        const allDocumentFileLoaders=Object.values(flowise.nodesPool.componentNodes).filter(a=>a.category="Document Loaders")
        const docs=await Promise.all(
            file.split(",").map(async url=>{
                let [ext]=url.split(".").reverse()
                ext='.'+ext
                let param
                const loader=allDocumentFileLoaders.find(a=>param=a.inputs.find(b=>a.type=="file" && a.fileType==ext))
                if(!loader){
                    return 
                }
                
                return await loader.init({...inputs, [param.name]:await fetchBase64(url)})
            })
        )
        const all=docs.flat().filter(a=>!!a)
        return all
    }
}

async function fetchBase64(url){
    const fetch=require('node-fetch2')
    const res=await fetch(url)
    const base64Data = Buffer.from(await res.arrayBuffer(), 'binary').toString('base64');
    const dataURI = `data:${res.headers['content-type']};base64,${base64Data}`;
    return dataURI
}

module.exports={nodeClass: Node}