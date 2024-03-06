module.exports={
    credClass:class{
        constructor(){
            Object.assign(this,{
                label:"ali tongyi API",
                name:"aliApi",
                version:1.0,
                description:"",
                inputs:[
                    {
                        label: 'Alibaba Api Key',
                        name: 'alibabaApiKey',
                        type: 'password',
                        placeholder: '<ALIBABA_API_KEY>'
                    }
                ]
            })
        }
    }
}