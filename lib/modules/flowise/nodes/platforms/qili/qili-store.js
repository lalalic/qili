const {InMemoryFileStore}=require('langchain/stores/file/in_memory')

class QiliFileStore extends InMemoryFileStore{
    constructor(qili, basePath, user){
        super(...arguments);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "stores", "file", "qili"]
        });
        Object.defineProperty(this, "basePath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: basePath||""
        });
        Object.defineProperty(this, "qili", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: qili
        });
        Object.defineProperty(this, "user", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: user
        });
    }
    
    async writeFile(path, contents) {
        contents=typeof(contents)=="string" ? Buffer.from(contents) : contents
        await this.qili.upload({key:`${this.basePath}/${path}`, uri: `data:*/*;base64,${contents.toString('base64')}`},this.user)
    }

    async readFile(path) {
        return await this.qili.readFile(`${this.basePath}/${path}`, this.user)
    }
}

module.exports=QiliFileStore