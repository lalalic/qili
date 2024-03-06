module.exports={
    credClass:class{
        constructor(){
            Object.assign(this,{
                label:"baidu wenxin API",
                name:"baiduApi",
                description:"",
                version:1.0,
                inputs:[
                    {
                        label: 'Baidu Api Key',
                        name: 'baiduApiKey',
                        type: 'password',
                        placeholder: '<BAIDU_API_KEY>'
                    },
                    {
                        label: 'Baidu Secret Key',
                        name: 'baiduSecretKey',
                        type: 'password',
                        placeholder: '<BAIDU_SECRET_KEY>'
                    }
                ]
            })
        }
    }
}