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
		  $sms_name: String
		) {
		  app_update(_id: $id, name: $name, uname: $uname, isDev: $isDev, sms_name: $sms_name) {
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
	"routes_apps_Query":`query routes_apps_Query(
		  $name: String
		) {
		  anonymous_apps(name: $name) {
		    id
		    name
		    uname
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
		  sms_name
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
		        ...qili_comment
		        id
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
		
		fragment qili_comment on Comment {
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
		}
		`,
	"console_log_Query":`query console_log_Query(
		  $id: ObjectID!
		  $status: String
		  $count: Int = 20
		  $cursor: JSON
		) {
		  me {
		    app(_id: $id) {
		      ...log_app
		      id
		    }
		    id
		  }
		}
		
		fragment log_app on App {
		  logs(status: $status, first: $count, after: $cursor) {
		    edges {
		      node {
		        id
		        startedAt
		        type
		        operation
		        status
		        time
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
		`,
	"console_my_apps_Query":`query console_my_apps_Query {
		  user: me {
		    ...my_user
		    phone
		    id
		  }
		}
		
		fragment my_user on User {
		  ...qili_account_user
		  apps {
		    id
		    name
		  }
		}
		
		fragment qili_account_user on User {
		  id
		  photo
		  username
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
	"console_profile_Query":`query console_profile_Query {
		  user: me {
		    ...qili_profile_user
		    id
		  }
		}
		
		fragment qili_profile_user on User {
		  id
		  username
		  birthday
		  gender
		  location
		  photo
		  signature
		}
		`
}