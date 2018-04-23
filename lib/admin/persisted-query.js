//generated from persisted-query.js, don't edit it
module.exports={
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
	"account_update_Mutation":`mutation account_update_Mutation(
		  $photo: String
		) {
		  user_update(photo: $photo)
		}
		`,
	"authentication_login_Mutation":`mutation authentication_login_Mutation(
		  $contact: String!
		  $token: String!
		  $name: String
		) {
		  login(contact: $contact, token: $token, name: $name) {
		    id
		    token
		  }
		}
		`,
	"authentication_requestToken_Mutation":`mutation authentication_requestToken_Mutation(
		  $contact: String!
		) {
		  requestToken(contact: $contact)
		}
		`,
	"comment_create_Mutation":`mutation comment_create_Mutation(
		  $parent: ID!
		  $content: String!
		  $type: CommentType
		  $id: ObjectID
		) {
		  comment: comment_create(parent: $parent, content: $content, type: $type, _id: $id) {
		    __typename
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
		}
		`,
	"file_create_Mutation":`mutation file_create_Mutation(
		  $_id: String!
		  $host: ID!
		  $bucket: String
		  $size: Int
		  $crc: Int
		  $mimeType: String
		  $imageInfo: JSON
		) {
		  file_create(_id: $_id, host: $host, bucket: $bucket, size: $size, crc: $crc, mimeType: $mimeType, imageInfo: $imageInfo) {
		    url
		    id
		  }
		}
		`,
	"file_token_Query":`query file_token_Query(
		  $key: String
		) {
		  token: file_upload_token(key: $key) {
		    token
		    id
		  }
		}
		`,
	"userProfile_update_Mutation":`mutation userProfile_update_Mutation(
		  $photo: String
		  $username: String
		  $birthday: Date
		  $gender: Gender
		  $location: String
		  $signature: String
		) {
		  user_update(photo: $photo, username: $username, birthday: $birthday, gender: $gender, location: $location, signature: $signature)
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
		        __typename
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
		        __typename
		        ...log
		        id
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
		    name
		    token
		    apps {
		      id
		      name
		      apiKey
		    }
		    id
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