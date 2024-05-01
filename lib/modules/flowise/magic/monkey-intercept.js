/**
 * use name to control if interceptor should run again or not
 * * static/global/prototype should only be intercepted once
 * @param {*} target 
 * @param {*} fx 
 * @param {*} factory 
 * @param {*} name 
 * @returns 
 */
module.exports=function monkeyIntercept(target, fx, factory, name=factory){
    const func=target[fx]
    
    if(!func){
        return 
    }

    if(func.interceptors && func.interceptors.indexOf(name)!=-1){
        return func
    }

    const intercepted=factory(func)
    target[fx] = intercepted
    intercepted.interceptors=[...(func.interceptors||[]),name]
}