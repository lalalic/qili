const fetch=require('node-fetch2')
    
class Node{
    constructor() {
        this.label = 'Qili Document Loader'
        this.name = 'anyFile'
        this.version = 1.0
        this.type = 'Document'
        this.icon = 'qili-ai.svg'
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

    getLoaderFromResponse(res, nodes){
        const allDocumentFileLoaders=Object.values(nodes)
            .filter(a=>a.category=="Document Loaders" && a.name!==this.name)
        
        const contentType=res.headers.get('content-type')
        const [type, sub, encoding]=contentType.split(/[/;]/).map(a=>a.trim())
        const ext=({
            ["vnd.openxmlformats-officedocument.wordprocessingml.document"]:'docx',
            plaintext:'txt',
        })[sub]||sub

        let param=null
        const loader=allDocumentFileLoaders.find(a=>param=a.inputs.find(b=>b.type=="file" && b.fileType.indexOf('.'+ext)!=-1))
        if(loader)
            return [loader, param.name]
        if(type=="text")
            return [nodes.textFile, 'txtFile']
    }


    async init({inputs:{file="", metadata, ...inputs}, outputs={}}, _, options, qili, flowise){
        const docs=await Promise.all(
            file.split(",").filter(a=>!!a).map(async url=>{
                try{
                    const res=await fetch(url)
                    
                    const [loader,pname]=this.getLoaderFromResponse(res, flowise.nodesPool.componentNodes)
                    if(loader){
                        if(Array.isArray(loader.outputs) &&  loader.outputs.length>1){
                            outputs.output=loader.outputs[0].name
                        }

                        const dataUri=await fetchBase64(res)
                        
                        const docs=await loader.init({inputs:{...inputs, [pname]:dataUri}, outputs})
                        docs.forEach(doc=>clean(Object.assign(doc.metadata,{
                            url,
                            ...metadata, 
                            etag: res.headers.get('etag'),
                            lastModified: Date.parse(res.headers.get('last-modified'))
                        })))
                        return docs
                    }
                }catch(e){
                    console.warn(`loading ${url} error: ${e.message}`)
                }
            })
        )
        const all=docs.flat().filter(a=>!!a)
        return all
    }
}

async function fetchBase64(res){
    const [fileName]=res.url.split("?")[0].split("/").reverse()
    const base64Data = Buffer.from(await res.arrayBuffer(), 'binary').toString('base64');
    const dataURI = `data:${res.headers.get('content-type')||'*/*'};base64,${base64Data},filename:${fileName}`;
    return dataURI
}


const cleanables=[null,undefined,""]
function clean(ob){
    Object.keys(ob).forEach(k=>{
        if(cleanables.indexOf(ob[k])!=-1){
            delete ob[k]
        }
    })
    return ob
}
module.exports={nodeClass: Node}