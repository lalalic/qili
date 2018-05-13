//generated from persisted-query.js, don't edit it
module.exports={
	"app_canRunInCore_Mutation":`mutation app_canRunInCore_Mutation(
		  $id: ObjectID!
		  $canRunInCore: Boolean
		) {
		  app_canRunInCore(_id: $id, canRunInCore: $canRunInCore) {
		    updatedAt
		    canRunInCore
		    id
		  }
		}
		`,
	"app_create_Mutation":`mutation app_create_Mutation(
		  $name: String!
		  $uname: String
		) {
		  app_create(name: $name, uname: $uname) {
		    id
		  }
		}
		`,
	"app_remove_Mutation":`mutation app_remove_Mutation(
		  $id: ObjectID!
		) {
		  app_remove(_id: $id)
		}
		`,
	"app_update_Mutation":`mutation app_update_Mutation(
		  $id: ObjectID!
		  $name: String
		  $uname: String
		  $isDev: Boolean
		) {
		  app_update(_id: $id, name: $name, uname: $uname, isDev: $isDev) {
		    updatedAt
		    id
		  }
		}
		`,
	"cloud_update_Mutation":`mutation cloud_update_Mutation(
		  $id: ObjectID!
		  $cloudCode: String!
		) {
		  app_update(_id: $id, cloudCode: $cloudCode) {
		    cloudCode
		    schema
		    id
		  }
		}
		`,
	"console_app_update_Query":`query console_app_update_Query(
		  $id: ObjectID!
		) {
		  me {
		    app(_id: $id) {
		      ...app
		      id
		    }
		    id
		  }
		}
		
		fragment app on App {
		  id
		  name
		  uname
		  apiKey
		  isDev
		  canRunInCore
		}
		`,
	"console_cloud_Query":`query console_cloud_Query(
		  $id: ObjectID!
		) {
		  me {
		    app(_id: $id) {
		      ...cloud_app
		      id
		    }
		    id
		  }
		}
		
		fragment cloud_app on App {
		  cloudCode
		  ...schema_app
		}
		
		fragment schema_app on App {
		  schema
		}
		`,
	"console_comment_Query":`query console_comment_Query(
		  $parent: ObjectID!
		  $count: Int = 10
		  $cursor: JSON
		) {
		  ...console_appComments
		}
		
		fragment console_appComments on Query {
		  comments: app_comments(parent: $parent, last: $count, before: $cursor) {
		    edges {
		      node {
		        id
		        content
		        type
		        createdAt
		        author {
		          id
		          name
		          photo
		        }
		        isOwner
		        __typename
		      }
		      cursor
		    }
		    pageInfo {
		      hasPreviousPage
		      startCursor
		    }
		  }
		}
		`,
	"console_log_Query":`query console_log_Query(
		  $id: ObjectID!
		  $status: String
		  $count: Int
		  $cursor: JSON
		) {
		  me {
		    app(_id: $id) {
		      ...console_logApp
		      id
		    }
		    id
		  }
		}
		
		fragment console_logApp on App {
		  logs(status: $status, first: $count, after: $cursor) {
		    edges {
		      node {
		        ...log
		        id
		        __typename
		      }
		      cursor
		    }
		    pageInfo {
		      hasPreviousPage
		      startCursor
		      endCursor
		      hasNextPage
		    }
		  }
		}
		
		fragment log on Log {
		  id
		  startedAt
		  type
		  operation
		  status
		  time
		  variables
		  report
		}
		`,
	"console_my_apps_Query":`query console_my_apps_Query {
		  me {
		    ...my
		    id
		  }
		}
		
		fragment my on User {
		  id
		  username
		  photo
		  apps {
		    id
		    name
		  }
		}
		`,
	"console_prefetch_Query":`query console_prefetch_Query {
		  me {
		    id
		    name
		    token
		    apps {
		      id
		      name
		      apiKey
		    }
		  }
		}
		`,
	"console_userProfile_me_Query":`query console_userProfile_me_Query {
		  me {
		    id
		    username
		    birthday
		    gender
		    location
		    photo
		    signature
		  }
		}
		`
}