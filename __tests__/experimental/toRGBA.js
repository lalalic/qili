async function asRGBA(url){
    const {PNG} = require('pngjs')
    const fetch=require('node-fetch2')
    const res=await fetch(url)
    const buffer=await res.buffer()

    const png=PNG.sync.read(buffer)
    const changed=PNG.sync.write(png, {colorType:6 })
    const Blob = require('buffer').Blob;

    return Object.assign(new Blob([changed],{type:"image/png"}),{
        name:"a.png",
        lastModified: Date.now(),
    })
}

asRGBA("https://oaidalleapiprodscus.blob.core.windows.net/private/org-G698pSGE1aR9i6qPST3Cm0WJ/user-fFK4VUmnj4YaNHgzjMHxQcur/img-pBIP47SHMnvOsBvu4q5QWglH.png?st=2023-11-27T23%3A32%3A21Z&se=2023-11-28T01%3A32%3A21Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2023-11-27T13%3A59%3A08Z&ske=2023-11-28T13%3A59%3A08Z&sks=b&skv=2021-08-06&sig=2K0115apqkFH1meLYFKp%2BfgC%2BTuWqGVQqyDy5uHQEjI%3D")




