const {FileSystemUpdatesStorage, ExpoUpdatesStorageApi,  manifest}=require("expo-updates-server")

module.exports=function (staticService, modules){
    if(this.app.appUpdates){
        let storage=new FileSystemUpdatesStorage(this.app.appUpdates)
        staticService.on(`/${this.app.appUpdates.context||"updates"}/manifest`,(req, res)=>{
            manifest(storage)(req, res)
        })
        return staticService
    }

    modules.forEach(({appUpdates})=>{
        if(!appUpdates){
            return
        }

        let storage=null
    
        if(appUpdates.fromManifestURI){
            storage=ExpoUpdatesStorageApi.fromManifestURI(info=>appUpdates.fromManifestURI(info, this))
        }else{
            storage=Object.assign(new ExpoUpdatesStorageApi(),appUpdates)
        }

        if(storage){
            storage.app=this
            staticService.on(`/${appUpdates.context||"updates"}/manifest`,(req, res)=>{
                manifest(storage)(req, res)
            })
        }
    },null)

    return staticService
}