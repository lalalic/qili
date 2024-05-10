const fs = require('fs');
const path = require('path');

module.exports=async function iterateFiles(root, fx) {
    return new Promise((resolve,reject)=>{
        fs.readdir(root, (err, files) => {
            if (err) {
                reject(err)
                return;
            }

            Promise.all(
                files.map(file => {
                    const filePath = `${root}/${file}`;
                    return new Promise((resolve1,reject1)=>{
                        fs.stat(filePath, async (err, stats) => {
                            if (err) {
                                reject1(err)
                                return;
                            }

                            try{
                                if (stats.isDirectory()) {
                                    // Recursively call iterateFiles for subdirectories
                                    resolve1(await iterateFiles(filePath, fx))
                                } else {
                                    resolve1(await fx?.(filePath))
                                }
                            }catch(e){
                                reject1(e)
                            }
                        })
                    })
                })
            ).then(all=>resolve(all.flat().filter(a=>!!a)), reject)
        })
    })
}
