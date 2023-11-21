const fs=require('fs')
const requireFactory=require("../../lib/vm-require")
 
describe('vm-require',()=>{
    const context=require('vm').createContext({})
    const root=`${__dirname}/root`
    
    beforeEach(()=>{
        fs.writeFileSync(`${root}/data.js`,`module.exports={name:"test"}`)
    })


    it("reload main lead to reload all",()=>{
        const require1=requireFactory({root,context}) 
        let data=require1('./data.js')
        console.log(data)
        expect(data.name).toBe('test')
        fs.writeFileSync(`${root}/data.js`,`module.exports={"name":"test2"}`)
        require1.clearCache('./data.js') 
        data=require1('./data.js')
        expect(data.name).toBe('test2')    
    })
})