const {pptx}=require('docx4js')
class Node{
    constructor(){
        Object.assign(this,{
            label:"pptx",
            name:"pptxFile",
            type:"Document",
            version: 1.0,
            icon: "qili-ai.svg",
            category: "Document Loaders",
            description:"Load data from pptx files",
            baseClasses : ['Document'],
            inputs:[
                {
                    label: 'pptx File',
                    name: 'pptxFile',
                    type: 'file',
                    fileType: '.pptx'
                }
            ]
        })
    }

    async init(nodeData){
        const file = nodeData.inputs?.pptxFile

        const blob=await (async ()=>{
            const url=new URL(file)
            if(url.protocol=="data"){
                const splitDataURI = file.split(',')
                splitDataURI.pop()
                const bf = Buffer.from(splitDataURI.pop() || '', 'base64')
                return  new Blob([bf])
            }else{
                const fetch=require("node-fetch")
                return fetch(url).then(res=>res.blob())
            }
        })();
        return pptx.load(blob.arrayBuffer())
            .then(doc=>{
                const slides=new Proxy([[[]]], {
                    get(target, key){
                        if(key==="current"){
                            return target[target.length-1]
                        }else if(key==="p"){
                            const slide=slides.current
                            return slide[slide.length-1]
                        }
                        return target[key]
                    }
                })
                doc.render(function createElement(type,props,children){
                    switch(type){
                        case "slideLayout":
                            slides.current.splice(0,Number.MAX_SAFE_INTEGER,[])
                        break
                        case "slide":
                            slides.current.pop()
                            slides.push([[]])
                        break
                        case "p":
                            slides.current.push([])
                        break
                        case "t":
                            slides.p.push(children)
                        break	
                    }
                    return {type,props,children}
                })
                slides.pop()
                const content=slides.map((paragraphs,i)=>`slide #${i+1}:\n${paragraphs.map(a=>a.join("")).join("\n")}`).join("\n")
                return [{pageContent:content}]
            })
    }
}

module.exports={nodeClass: Node}