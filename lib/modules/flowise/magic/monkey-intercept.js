module.exports=function monkeyIntercept(target, fx, factory, name=factory){
    const func=target[fx]
    
    if(func.interceptors && func.interceptors.indexOf(name)!=-1){
        return func
    }

    const intercepted=factory(func)
    target[fx] = intercepted
    intercepted.interceptors=[...(func.interceptors||[]),name]
}