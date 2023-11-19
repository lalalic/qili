module.exports=function(){
    const emptyFx=e=>e
    return new Proxy({
        use(){

        },
        get(){

        }
    },{
        get(target, key){
            return emptyFx
        }
    })
}