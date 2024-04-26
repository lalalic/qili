const { DynamicTool} = require('langchain/tools')
const fetch=require("node-fetch")
const { exec } = require('child_process');

class Ffmpeg{
    constructor(){
        Object.assign(this,{
            label:"ffmpeg",
            name:"ffmpeg",
            type:"ffmpeg",
            category:"Tools",
            version:"1.0",
            description:"run ffmpeg",
            icon:`qili-ai.svg`,
            baseClasses:["ffmpeg","Tool"],
            inputs:[
                {
                    label:"command",
                    name:"command",
                    type:"options",
                    options:[
                        {name:"slideshow", label:"slideshow", description:"create slideshow video with images, and audios"},
                        {name:"ffmpeg", label:"command", description:"ffmpeg tools"}
                    ]
                },
                {
                    label:"value",
                    name:"value",
                    type:"string",
                    rows: 4
                }
            ]
        })
    }

    init({inputs:{command, value}}, _, options, qili, flowise){
        const ctx=flowise.extractRunMetadata(options)

        return new DynamicTool({
            name:command,
            description:"ffmpeg tools: each line is a resource",
            returnDirect:true,
            func:async (input, runManager)=>{
                try{
                    value=(value||"").replaceAll("{input}",input||"").trim()
                    if(value){
                        const startTime=Date.now()
                        const output=await this[command]?.(value, qili, ctx.author)
                        return {output, cost: (Date.now()-startTime)/10}
                    }
                    return ""
                }catch(e){
                    return e.message
                }
            }
        })
    }

    async download(url, to){
        return new Promise(async (resolve,reject)=>{
            const res=await fetch(url)
            if(!res.ok){
                reject("not ok")
                return 
            }

            if(to.trim().split("/").pop().indexOf(".")==-1){
                const [,ext='.png']=res.headers.get('content-type').split(/[/;=]/)
                to=`${to}.${ext}`
            }
        
            res.body.pipe(require('fs').createWriteStream(to))
            res.body.on('finish',()=>{
                resolve(to)
            })
            res.body.on('error',error=>{
                reject(error)
            })
        })
    }

    async downloadInputs(command, folder){
        return Promise.all(
            command.split(/\s+/)
                .map((a,i,all)=>{
                    if(all[i-1]!="-i")
                        return a
                    if(!a.match(/^https?:\/\//))
                        return a
                    return this.download(a, `${folder}/file${i}`)
                })
        ).then(all=>all.join(" "))
    }

    async slideshow(input, qili, author){
        const uuid=require('uuid').v4()
        const folder=`${require('os').tmpdir()}/qili2-ffmpeg-${uuid}`
        try{
            require('fs').mkdirSync(folder)
            const files=await Promise.all(
                input.trim().split(/[,;\n]/).map(a=>a.trim()).filter(a=>!!a)
                    .map((url,i)=>this.download(url, `${folder}/file${i}`))
            )

            const videos=await Promise.all(
                files.reduce((col, a,i)=>{
                    if(i%2 ==1){
                        col.push([files[i-1], a])
                    }
                    return col
                },[]).map(([video, audio], i)=>{
                    return new Promise((resolve,reject)=>{
                        exec(`ffmpeg -y -loop 1 -i ${video} -i ${audio} -c:v libx264 -c:a copy -b:a 192k -vf format=yuv420p -shortest ${i}.mp4`,{cwd:folder}, (error)=>{
                            if(error){
                                reject(error)
                                return 
                            }
                            resolve(`file '${i}.mp4'`)
                        })
                    })
                })
            )

            require('fs').writeFileSync(`${folder}/videos.txt`, videos.join("\n"))

            await new Promise((resolve,reject)=>{
                exec(`ffmpeg -y -f concat -safe 0 -i videos.txt -movflags +faststart -c copy output.mp4`,{cwd:folder},(error)=>{
                    if(error){
                        reject(error)
                        return 
                    }
                    resolve(`output.mp4`)
                })
            })

            return  await qili.upload({
                uri: `${folder}/output.mp4`,
                key:`_temp_/60/${uuid}.mp4`
            }, author)
        }finally{
            require('fs').rm(folder,{recursive:true, force:true}, ()=>1)
        }
    }

    async ffmpeg(input, qili, author){
        const uuid=require('uuid').v4()
        const folder=`${require('os').tmpdir()}/qili2-ffmpeg-${uuid}`
        try{
            require('fs').mkdirSync(folder)
            await new Promise(async (resolve,reject)=>{
                if(!input.startsWith("ffmpeg")){
                    input=`ffmpeg ${input}`
                }
                input=await this.downloadInputs(input, folder)
                exec(input,{cwd:folder}, (error)=>{
                    if(error){
                        reject(error)
                        return 
                    }
                    resolve()
                })
            })

            const fileName=input.split(/\s+/).pop()
            if(require('fs').existsSync(`${folder}/${fileName}`)){
                return  await qili.upload({
                    uri: `${folder}/${fileName}`,
                    key:`_temp_/60/${uuid}.${fileName.split(".").pop()}`
                }, author)
            }
            return ""
        }catch(e){
            return e.message
        }finally{
            require('fs').rm(folder,{recursive:true, force:true}, ()=>1)
        }
    }

    static cost(run){
        return run.output.cost
    }
}

module.exports={nodeClass: Ffmpeg}

