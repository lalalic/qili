
jest.mock("../conf",()=>({
    db:{
        host:"127.0.0.1",
        port:27017
    }
}))

jest.mock("../lib/logger",()=>({
    error(m){
        console.error(m)
    }
}))
const MongoDataService=require("../lib/data-service")
describe("data service: MongoDB 3.4",()=>{
    let db, mongoProcess
    const Table="Test", apiKey=`DBTest${Date.now()}`
    const TEST={name:"tester", age:40, gender: 'male'}
    const dbpath=`${__dirname}/testDBService`
    beforeAll(async ()=>{
        require('fs').mkdirSync(dbpath,{recursive:true})
        const stdio="ignore"
        mongoProcess=require('child_process')
            .spawn(
                "mongod",
                ["--storageEngine=wiredTiger", "--directoryperdb", `--dbpath=${dbpath}`],
                {stdio:[stdio, stdio, stdio], killSignal:'SIGINT'}
            )
        await new Promise(resolve=>setTimeout(resolve, 2*1000))
        db=new MongoDataService({apiKey})
        db.resolver={Mutation:{file_clean(){}}}
    },30000)

    afterAll(async ()=>{
        mongoProcess.kill()
        await new Promise(resolve=>setTimeout(resolve, 2*1000))
        require('fs').rmdirSync(dbpath, {recursive:true, force:true})
    })

    afterEach(async ()=>{
        await db.removeEntity(Table,{})
    })

    it('makeId',()=>{
        expect(db.makeId()).not.toBe(db.makeId())
    })

    describe("need Entity",()=>{
        let test=null
        beforeEach(async()=>{
            test=await db.createEntity(Table,TEST)
            expect(test).toBeTruthy()
            expect(test._id).toBeTruthy()
        })

        it("createEntity",async ()=>{
            expect(await db.get1Entity(Table,{_id:test._id})).toMatchObject(test)
        })

        it("updateEntity",async ()=>{
            await db.updateEntity(Table,{_id:test._id},{...test, age:30})
            expect(await db.get1Entity(Table,{_id:test._id})).toMatchObject({...test,age:30})
        })
    
        it("patchEntity", async()=>{
            await db.patchEntity(Table,{_id:test._id},{age:30})
            expect(await db.get1Entity(Table,{_id:test._id})).toMatchObject({...test,age:30})
        })
    
        it("remove1Entity", async()=>{
            await db.remove1Entity(Table,{_id:test._id})
            expect(await db.get1Entity(Table,{_id:test._id})).toBeFalsy()
        })

        it("removeEntity",async()=>{
            await db.removeEntity(Table,{_id:test._id})
            expect(await db.get1Entity(Table,{_id:test._id})).toBeFalsy()
        })
        
        it("get1Entity", async()=>{
            expect(await db.get1Entity(Table,{_id:test._id})).toMatchObject(test)
        })

        it("findEntity", async()=>{
            expect(await db.findEntity(Table,{_id:test._id})).toMatchObject([test])
        })
    })

    fdescribe("pagination", ()=>{
        beforeAll(async()=>{
            const amount=100
            await Promise.all(new Array(amount).fill(0).map(async()=>{
                await db.createEntity(Table, {...TEST})
            }))

            const tests=await db.findEntity(Table,{},{_id:1})
            expect(tests.length).toBe(amount)
        }, 5000)

        it("nextPage: first", async()=>{
            const tests=await db.nextPage(Table,{first:20},{_id:1})
            expect(tests.edges.length).toBe(20)
            expect(tests.hasNextPage).toBeTruthy()
            expect(tests.hasPrevPage).toBeFalsy()
        })


        it("prevPage", async()=>{
            
        })
    })
    
    it("buildIndexes",async ()=>{
        await db.buildIndexes({[Table]:[{name:1}, {age:1}]})
    })
})