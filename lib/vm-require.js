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
module.exports=({root, context, blacklist=[], whitelist=[], watches, onChange})=>{
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
                    if(absoluteName==main){
                        Object.keys(caches).forEach(key=>delete caches[key])
                    }else{
                        delete caches[absoluteName]
                    }
                    onChange && onChange(fileName)

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
            const modulePathRoot=modulePath.split("/")[0]
            if(whitelist.indexOf(modulePathRoot)!=-1){
                return require(modulePath)                
            }

            if(blacklist.indexOf(modulePathRoot)!=-1){
                return new Error(`[${modulePathRoot}]Not supported module!`)
            }

            if(Module.isBuiltin(modulePathRoot)){    
                return require(modulePath)
            }

            const resolvedPath = resolveFilename(modulePath);
            
            if(require.extensions && require.extensions['.js']){
                const ext=path.extname(resolvedPath)
                if(ext && !(ext in require.extensions)){
                    return fs.readFileSync(resolvedPath)
                }
            }
            try{
                if(caches[resolvedPath]){
                    return caches[resolvedPath].exports
                }

                const m = new Module(resolvedPath, parentModule);

                m._compile = function (content, filename) {
                    const compiledWrapper = Module.wrap(content);
                    const compiledFunction = vm.runInContext(compiledWrapper, context,{filename:resolvedPath});
                    compiledFunction.call(m.exports, m.exports, createRequire(m), m, filename, path.dirname(filename));
                };

                m.load(resolvedPath)
                caches[resolvedPath]=m

                return m.exports;
            }catch(e){
                console.error(`require[${resolvedPath}]: ${e.message}`)
            }
        }

        customRequire.resolve=resolveFilename
        customRequire.extensions=require.extensions
        customRequire.clearCache=(fileName)=>{
            if(!fileName){
                Object.keys(caches).forEach(a=>delete caches[a])
                console.warn(`all vm-require caches are removed from vm-require since changed`)
            }else{
                const absoluteName=path.join(root, fileName)
                if(absoluteName in caches){
                    delete caches[absoluteName]
                    console.warn(`${fileName} is removed from vm-require since changed`)
                }
            }
        }
        
        return customRequire
    }

    return createRequire(mainModule)
}

// const {argv:[,,basePath,requirePath]}=process

// module.exports({excludes:["graphql-redis-subscriptions"],root:basePath,context:vm.createContext({process, Cloud:{addModule(){}}})})(requirePath)
