process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const fetch=require('node-fetch')


;(async()=>{
    const res=await fetch('https://ai.qili2.com/upload/$temp/1/1698935389345/1.jpeg',{method:"get"})
    const buffer=await res.buffer()
    console.log(buffer.toString('base64'))
    
})();
