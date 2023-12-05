module.exports=(()=>{
    const fs=require('fs')
    const files = fs.readdirSync(__dirname);
    return files.reduce((collected, file)=>{
        const [name]=file.split(".")
        collected[name]=require(`${__dirname}/${file}`)
        return collected
    },{})
})();