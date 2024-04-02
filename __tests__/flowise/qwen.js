const {ChatAlibabaTongyi}=require("../../lib/modules/flowise/nodes/chat-models/ali/core")
const {HumanMessage, SystemMessage} = require("langchain/schema");

require("dotenv").config({override:true})

describe("qwen-turbo Model",()=>{
    it("text generation",async ()=>{
        const chat=new ChatAlibabaTongyi({modelName:"qwen-turbo"})
        const res=await chat.invoke("hello")
        expect(!!res.content?.length).toBeTruthy()
    })

    describe("mutilmodel: vision",()=>{
        async function test(input){
            const chat=new ChatAlibabaTongyi({modelName:"qwen-vl-plus"})
            debugger
            const res= await chat.call(input)
            console.log(res)
            return res
        }

        it("hello",async ()=>{
            const res=await test([new HumanMessage({content:"hello"})])
            expect(!!res.content?.length).toBeTruthy()
            
        })

        fit("image problem",async ()=>{
            const problem="https://img2020.cnblogs.com/i-beta/1388256/202003/1388256-20200303165510390-395584188.png"
            const res=await test([
                new SystemMessage({content:[{text:"你是一个物理老师"},{text:"在回复中不要重复题目"}]}),
                new HumanMessage({content:[{text:'如何做这道题'},{image:problem}]})
            ])
            expect(!!res.content?.length).toBeTruthy()
        }, 60*1000)
    })
    
})