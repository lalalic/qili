function extractText(output, keys=["output","text","content","value"]){
    switch(typeof(output)){
        case "object":
            return extractText( output[keys.find(a=>a in output)]?? output[Object.keys(output)[0]])
        default:
            return output
    }
}

extractText.extractOutputKey=function(output,keys=["output","text","content","value"]){
    return keys.find(a=>a in output) || Object.keys(output)[0]
}

module.exports=extractText
