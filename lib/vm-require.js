const { Module } = require('module')
const path = require('path')
const fs = require("fs")
const vm=require('vm')

/**
 * 
 * root: any module or node_modules in root can be required
 * context: sandbox context
 * blacklist: built-in blacklist, return new Error(), but not throw
 * @param {*} param0 
 * @returns 
 */
module.exports=({root, context, blacklist=[], excludes=[], watches})=>{
    if(!root)
        return 

    root=path.resolve(root)

    //const sandbox = vm.createContext(context);

    const pkg=require(`${root}/package.json`)
    const main=path.resolve(root, pkg?.main||"./index.js")
    
    const mainModule=new Module(main)
    mainModule.filename = main;
    mainModule.paths = Module._nodeModulePaths(mainModule.path)
    const caches={}

    if(watches){
        fs.watch(root,{recursive:true},(eventType, fileName)=>{
            if(watches?.test(fileName)){
                const absoluteName=path.join(root, fileName)
                if(absoluteName in caches){
                    delete caches[absoluteName]
                    console.warn(`${fileName} is removed from vm-require since changed`)
                }
            }
        })
        console.info(`${root} is watched for code change...`)
    }

    const createRequire=parentModule=>{
        parentModule.paths.splice(parentModule.paths.findIndex(a=>!a.startsWith(root)))
        
        function resolveFilename(modulePath) {
            return Module._resolveFilename(modulePath, parentModule);
        }

        function customRequire(modulePath) {
            if(excludes.indexOf(modulePath)!=-1){
                return require(modulePath)                
            }

            if(Module.isBuiltin(modulePath)){
                if(blacklist.indexOf(modulePath)!=-1){
                    return new Error("Not supported module!")
                }
                return require(modulePath)
            }

            const resolvedPath = resolveFilename(modulePath);
            
            const ext=path.extname(resolvedPath)
            if(ext && !(ext in require.extensions)){
                return fs.readFileSync(resolvedPath)
            }

            try{
                if(caches[resolvedPath]){
                    return caches[resolvedPath].exports
                }

                const m = new Module(resolvedPath, parentModule);

                m._compile = function (content, filename) {
                    const compiledWrapper = Module.wrap(content);
                    const compiledFunction = vm.runInContext(compiledWrapper, context,{filename:resolvedPath});
                    compiledFunction.call(m.exports, m.exports, createRequire(m), m, filename);
                };

                m.load(resolvedPath)
                caches[resolvedPath]=m

                return m.exports;
            }catch(e){
                console.error(`circular dependency may happen: ${e.message}`)
            }
        }

        customRequire.resolve=resolveFilename
        customRequire.extensions=require.extensions
        
        return customRequire
    }

    return createRequire(mainModule)
}

// const {argv:[,,basePath,requirePath]}=process

// module.exports({excludes:["graphql-redis-subscriptions"],root:basePath,context:vm.createContext({process, Cloud:{addModule(){}}})})(requirePath)
