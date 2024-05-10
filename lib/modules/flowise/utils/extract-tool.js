/*
{name,description, iconSrc, color, schema, func}
schema: {id:[order], property:[name], description, type:[string|number|boolean|date], required:true|false}
*/
function extract(fx){ 
    const str=fx.toString()
    const {groups:{params, body}}=/\((?<params>[\s\S]*?)\)\s*\{(?<body>[\s\S]*)\}/g.exec(str)
    let desc="", id=0
    const schema=params.split("\n")
        .map(a=>a.trim()).filter(a=>!!a)
        .map(line=>{
            const [name, type, description]=line.split("//")
            if(!name.trim()){
                desc=type
                return 
            }
            return {
                id:id++, 
                property:name.replaceAll(/[,\$\s]/g,""), 
                type:type.replaceAll(/[\*\s]/g,""),
                required:type.indexOf('*')!=-1,
                description:description||undefined, 
            }
        }).filter(a=>!!a)

    return {
        _id:fx.name,
        name:fx.name, 
        description:desc||undefined,  
        schema: JSON.stringify(schema), 
        func:body, 
        color:"green", 
        iconSrc:"/qili-ai.svg"
    }
}

module.exports=extract