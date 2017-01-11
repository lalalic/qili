describe("entity", function(){
	var config=require('./config'),
		host=config.host,
		root=host+"/classes/books",
		$=require('./ajax')();

	beforeAll((done)=>config.init().then(done,done)	)

	afterAll((done)=>config.release().then(done,done))

	var uid=Date.now(),createBook

	describe("create with POST" ,function(){
		it("without _id", createBook=function(){
			var data={name:`my book ${uid++}`, title:`title ${uid}`}
			return $.ajax({type:'post',url:root,data})
				.then(book=>{
					expect(book._id).toBeDefined()
					expect(book.createdAt).toBeDefined()
					book._raw=data
					return book
				})
		})

		it("with _id", function(){
			var data={_id:`book${uid++}`, name:`my book ${uid++}`, title:`title ${uid}`}
			return $.ajax({type:'post',url:root,data})
				.then(book=>expect(book._id).toBe(data._id))
		})
	})

	describe("query with GET", function(){
		it(":id", function(){
			return createBook()
				.then(book=>$.get(`${root}/${book._id}`)
					.then(data=>expect(data._id).toBe(book._id))
				)
		})

		it("not exists get with id should return error", function(){
			return $.get(`${root}/book${uid++}`,{error:null})
				.then(fail,e=>e)
		})

		it("[all]", function(){
			return Promise.all([createBook(),createBook()])
				.then(()=>$.get(root))
				.then(data=>expect(data.results.length).toBeGreaterThan(1))
		})

		it('?query={name}', function(){
			return createBook()
				.then(book=>$.get(root+"?query="+JSON.stringify({name:book._raw.name}))
					.then(data=>{
						expect(data.results).toBeDefined()
						expect(data.results.length).toBe(1)
						expect(data.results[0].name).toBe(book._raw.name)
					})
				)
		})

		it("?limit=n", function(){
			return Promise.all([createBook(),createBook(),createBook()])
				.then(()=>$.get(root+"?limit=2"))
				.then(data=>{
					expect(data.results).toBeDefined()
					expect(data.results.length).toBe(2)
				})
		})

		it("direct doc returned from ?limit=1", function(){
			return createBook()
				.then(book=>$.get(root+"?limit=1&query="+JSON.stringify({name:book._raw.name}))
					.then(data=>expect(data.name).toBe(book._raw.name))
				)
		})

		it("?skip=n", function(){
			return Promise.all([createBook(),createBook(),createBook()]).then(()=>
				$.get(root).then(allBooks=>
					$.get(root+"?skip=3").then(skipedBooks=>{
						expect(allBooks.results).toBeDefined()
						expect(skipedBooks.results).toBeDefined()
						expect(allBooks.results.length-skipedBooks.results.length).toBe(3)
					})
				)
			)
		})

		it("?sort={name:1}", function(){
			return Promise.all([createBook(),createBook(),createBook()]).then((books)=>
				$.get(root+"?limit=2&sort="+JSON.stringify({name:1})).then((data)=>{
					expect(data.results).toBeDefined()
					expect(data.results.length).toBe(2)
					var names=data.results.map((a)=>a.name).sort()
					expect(data.results[0].name).toBe(names[0])
					expect(data.results[1].name).toBe(names[1])
				})
			)
		})

		it("?sort={name:-1}", function(){
			return Promise.all([createBook(),createBook(),createBook()]).then((books)=>
				$.get(root+"?limit=2&sort="+JSON.stringify({name:-1})).then((data)=>{
					expect(data.results).toBeDefined()
					expect(data.results.length).toBe(2)
					var names=data.results.map((a)=>a.name).sort()
					expect(data.results[0].name).toBe(names[1])
					expect(data.results[1].name).toBe(names[0])
				})
			)
		})

		it("?fields={name:true}", function(){
			return createBook().then((book)=>
				$.get(`${root}/${book._id}?fields=${JSON.stringify({name:true})}`).then((doc)=>{
					expect(doc.name).toBeDefined()
					expect(doc.title).toBeUndefined()
				})
			)
		})

		it("?fields={name:false}", function(){
			return createBook().then((book)=>
				$.get(`${root}/${book._id}?fields=${JSON.stringify({name:false})}`).then((doc)=>{
					expect(doc.name).toBeUndefined()
					expect(doc.title).toBeDefined()
				})
			)
		})
	})



	describe('update with PUT/PATCH', function(){
		it("update with PUT", function(){
			var title='read raymond'
			return createBook().then((book)=>
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
							})
					})
				)
		})

		it(" update with PATCH", function(){
			var title='read raymond'
			return createBook().then((book)=>
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
							})
					})
				)
		})

		it("update with POST", function(){
			var title='read raymond'
			return createBook().then((book)=>{
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
								})
						})
					}
				)
		})
	})

	it("delete with DELETE", function(){
		return createBook().then((book)=>
			$.ajax({
				type:'delete',
				url:`${root}/${book._id}`
			}).then((data)=>expect(data).toBeTruthy())
		)
	})
})
