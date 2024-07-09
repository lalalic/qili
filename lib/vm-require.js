const { Module: BuiltinModule } = require('module')
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
    const pkg=require(`${root}/package.json`)
    const main=path.resolve(root, pkg?.main||"./index.js")
    
    const mainModule=new BuiltinModule(main)
    mainModule.filename = main;
    mainModule.paths = [`${root}/node_modules`]
    mainModule.require=BuiltinModule.createRequire(main)

    const caches={}

    if(watches){
        fs.watch(root,{recursive:true},(eventType, fileName)=>{
            if(watches?.test(fileName)){
                const absoluteName=path.join(root, fileName)
                delete caches[absoluteName]
                onChange && onChange(fileName)
            }
        })
        console.info(`${root} is watched for code change...`)
    }

    function closest(m, current=m.parent){
        while(current){
            if(m.id==current.id){
                return current.exports
            }
            
            current=current.parent
        }     
    }

    const createRequire=(parentModule)=>{
        function resolveFilename(modulePath) {
            return BuiltinModule._resolveFilename(modulePath, parentModule);
        }

        function customRequire(modulePath) {
            if(whitelist.find(a=>modulePath.startsWith(a))){
                try{
                    return mainModule.require(modulePath)
                }catch(e){
                    return require(modulePath)
                }
            }
            
            if(blacklist.find(a=>modulePath.startsWith(a))){
                return new Error(`[${modulePath}]Not supported module!`)
            }

            if(BuiltinModule.isBuiltin(modulePath)){    
                return require(modulePath)
            }

            const resolvedPath = resolveFilename(modulePath);
            
            if(require.extensions && require.extensions['.js']){
                const ext=path.extname(resolvedPath)
                if(ext && !(ext in require.extensions)){
                    return fs.readFileSync(resolvedPath)
                }
            }

            if(caches[resolvedPath]){
                return caches[resolvedPath].exports
            }

            const m = new BuiltinModule(resolvedPath, parentModule);
            try{
                m._compile = function (content, filename) {
                    const compiledWrapper = BuiltinModule.wrap(content);
                    const compiledFunction = vm.runInContext(compiledWrapper, context,{filename:resolvedPath});
                    m.paths.splice(m.paths.findIndex(a=>!a.startsWith(root)))
                    compiledFunction.call(m.exports, m.exports, createRequire(m), m, filename, path.dirname(filename));
                };

                m.load(resolvedPath)
                caches[resolvedPath]=m

                return m.exports;
            }catch(e){
                const p=closest(m)
                console.warn(`require[${resolvedPath}]]: ${e.message}. move on with ${p ? "parent" : "self"} `)
                return (p||m).exports
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
