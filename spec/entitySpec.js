describe("entity", function(){
	var config=require('./config'),
		host=config.host,
		root=host+"/classes/books",
		$=require('./ajax')(),
		_=require('underscore');

	beforeAll((done)=>config.init().then(done,done)	)

	afterAll((done)=>config.release().then(done,done))

	var uid=Date.now(), NULL=(a)=>a, createBook

	describe("create with POST" ,function(){
		it("without _id", createBook=function(done){
			var data={name:`my book ${uid++}`, title:`title ${uid}`}
			return $.ajax({type:'post',url:root,data})
				.then(function(book){
					expect(book._id).toBeDefined()
					expect(book.createdAt).toBeDefined()
					done()
					book._raw=data
					return book
				},done)
		})

		it("with _id", function(done){
			var data={_id:`book${uid++}`, name:`my book ${uid++}`, title:`title ${uid}`}
			return $.ajax({type:'post',url:root,data})
				.then(function(book){
					expect(book._id).toBe(data._id)
					done()
					book._raw=data
					return book
				},done)
		})
	})

	describe("query with GET", function(done){
		it(":id", function(done){
			createBook(NULL).catch($.fail(done,"can't create entity book"))
				.then((book)=>$.get(`${root}/${book._id}`)
					.then((data)=>{
						expect(data._id).toBe(book._id)
						done()
					},done))
		})

		it("not exists get with id should return error", function(done){
			$.get(`${root}/book${uid++}`,{error:null})
				.then(function(data){
					fail()
					done()
				},function(error){
					expect(error).toBe('Not exists')
					done()
				})
		})

		it("[all]", function(done){
			Promise.all([createBook(null),createBook(null)])
				.then(()=>$.get(root)
					.then((data)=>{
						expect(data.results.length).toBeGreaterThan(1)
						done()
					},done)
				,done)
		})

		it('?query={name}', function(done){
			createBook(NULL).catch($.fail(done,"can't create book")).then((book)=>
				$.get(root+"?query="+JSON.stringify({name:book._raw.name}))
					.then((data)=>{
						expect(data.results).toBeDefined()
						expect(data.results.length).toBe(1)
						expect(data.results[0].name).toBe(book._raw.name)
						done()
					},done)
				)
		})

		it("?limit=n", function(done){
			Promise.all([createBook(NULL),createBook(NULL),createBook(NULL)])
				.then(()=>$.get(root+"?limit=2")
					.then((data)=>{
						expect(data.results).toBeDefined()
						expect(data.results.length).toBe(2)
						done()
					},done), done)
		})

		it("direct doc returned from ?limit=1", function(done){
			createBook(NULL).then((book)=>
				$.get(root+"?limit=1&query="+JSON.stringify({name:book._raw.name}))
					.then((data)=>{
						expect(data.name).toBe(book._raw.name)
						done()
					},done),done)
		})

		it("?skip=n", function(done){
			Promise.all([createBook(NULL),createBook(NULL),createBook(NULL)]).then(()=>
				$.get(root).then((allBooks)=>
					$.get(root+"?skip=3").then((skipedBooks)=>{
						expect(allBooks.results).toBeDefined()
						expect(skipedBooks.results).toBeDefined()
						expect(allBooks.results.length-skipedBooks.results.length).toBe(3)
						done()
					},done)
				,done)
			,done)
		})

		it("?sort={name:1}", function(done){
			Promise.all([createBook(NULL),createBook(NULL),createBook(NULL)]).then((books)=>
				$.get(root+"?limit=2&sort="+JSON.stringify({name:1})).then((data)=>{
					expect(data.results).toBeDefined()
					expect(data.results.length).toBe(2)
					var names=data.results.map((a)=>a.name).sort()
					expect(data.results[0].name).toBe(names[0])
					expect(data.results[1].name).toBe(names[1])
					done()
				},done)
			,done)
		})

		it("?sort={name:-1}", function(done){
			Promise.all([createBook(NULL),createBook(NULL),createBook(NULL)]).then((books)=>
				$.get(root+"?limit=2&sort="+JSON.stringify({name:-1})).then((data)=>{
					expect(data.results).toBeDefined()
					expect(data.results.length).toBe(2)
					var names=data.results.map((a)=>a.name).sort()
					expect(data.results[0].name).toBe(names[1])
					expect(data.results[1].name).toBe(names[0])
					done()
				},done)
			,done)
		})

		it("?fields={name:true}", function(done){
			createBook(NULL).then((book)=>
				$.get(`${root}/${book._id}?fields=${JSON.stringify({name:true})}`).then((doc)=>{
					expect(doc.name).toBeDefined()
					expect(doc.title).toBeUndefined()
					done()
				},done)
			,done)
		})

		it("?fields={name:false}", function(done){
			createBook(NULL).then((book)=>
				$.get(`${root}/${book._id}?fields=${JSON.stringify({name:false})}`).then((doc)=>{
					expect(doc.name).toBeUndefined()
					expect(doc.title).toBeDefined()
					done()
				},done)
			,done)
		})
	})



	describe('update with PUT/PATCH', function(){
		it("update with PUT", function(done){
			var title='read raymond'
			createBook(NULL).then((book)=>
				$.ajax({
						type:'put',
						url:`${root}/${book._id}`,
						data:{title}
					}).then((data)=>{
						expect(data.updatedAt).toBeDefined()
						$.get(`${root}/${book._id}`)
							.then((doc)=>{
								expect(doc.name).toBeUndefined()
								expect(doc.title).toBe(title)
								done()
							},done)
					},done)
				,done)
		})

		it(" update with PATCH", function(done){
			var title='read raymond'
			createBook(NULL).then((book)=>
				$.ajax({
						type:'patch',
						url:`${root}/${book._id}`,
						data:{title}
					}).then((data)=>{
						expect(data.updatedAt).toBeDefined()
						$.get(`${root}/${book._id}`)
							.then((doc)=>{
								expect(doc.name).toBeDefined()
								expect(doc.title).toBe(title)
								done()
							},done)
					},done)
				,done)
		})

		it("update with POST", function(done){
			var title='read raymond'
			createBook(NULL).then((book)=>{
					var data=Object.assign({},book,book._raw,
							{title,_raw:undefined,name:undefined,updatedAt:undefined})
					$.ajax({
							type:'post',
							url:`${root}`,
							data:data
						}).then((data)=>{
							expect(data.updatedAt).toBeDefined()
							$.get(`${root}/${book._id}`)
								.then((doc)=>{
									expect(doc.name).toBeUndefined()
									expect(doc.title).toBe(title)
									done()
								},done)
						},done)
					}
				,done)
		}, 1000000)
	})

	it("delete with DELETE", function(done){
		createBook(NULL).then((book)=>
			$.ajax({
				type:'delete',
				url:`${root}/${book._id}`
			}).then((data)=>{
				expect(data).toBeTruthy()
				done()
			},done)
		,done)
	})
})
