module.exports=function bestMatch(values, domain=""){
    return new Proxy(values,{
        get(target, k){
            k=k.toLowerCase()
            if(k in target)
                return target[k]
            const guess=(parts=>{
                while(parts.length){
                    const try1=parts.join("-")
                    if(try1 in target){
                        return Object.keys(target).filter(a=>a.startsWith(try1)).pop()
                    }
                    parts.pop()
                }
                return Object.keys(target).pop()
            })(k.split("-"))
            console.error(`${domain}${k} not found, use ${guess}.`)
            return target[guess]
        }
    })
}