const fetch=require("node-fetch2")
const http=require('http')

const OPENAI_API_KEY="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"
const OPENAI_URL="https://api.openai.com/v1/chat/completions"

// async function ask(question){

//     const res=await fetch(OPENAI_URL,{
//         method:"POST",
//         headers: {
//             "Content-Type": "application/json",
//             "Authorization": "Bearer " + OPENAI_API_KEY,
//         },
//         body:JSON.stringify({
//             model:"gpt-3.5-turbo",
//             messages:[{role:"user", content:question}]
//         })
//     })

//     console.log(res)

//     const {choices:[{message:{content}}], usage:{total_tokens}} = await res.json()
//     return {message:content, tokens: total_tokens}

// }

// ;(async()=>{
//     try{
//         const res=await ask("hello")
//         console.log(res)
//     }catch(e){
//         console.error(e)
//     }
// })();

const server=http.createServer(async (req, res)=>{
    if(req.method!=="POST"){
        res.statusCode=404
        res.end('Not Found')
        return 
    }
    res.setHeader("Content-Type", "application/json")
    const aiRes=await fetch(OPENAI_URL,{
        method:"POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + OPENAI_API_KEY,
        },
        body:req.body
    })
    res.writeHead(aiRes.status)
    res.end(JSON.stringify(await aiRes.json()))
})

server.listen(9080,"0.0.0.0")



