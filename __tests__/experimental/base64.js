const fetch=require('node-fetch')

;(async ()=>{
    const res=await fetch("http://ai.qili2.com/upload/ai/_temp_/1/2ee93a06-4562-4114-8312-1733f5bf727e/a.wav")
    const buffer=await res.buffer()
    console.log(buffer.toString('base64').length)

    const buffer2=require('fs').readFileSync(`${__dirname}/../../qili-ai/www/public/upload/ai/_temp_/1/2ee93a06-4562-4114-8312-1733f5bf727e/a.wav`)
    console.log(buffer2.toString('base64').length)
})();
