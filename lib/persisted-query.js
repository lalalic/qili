//generated from persisted-query.js, don't edit it
module.exports={
	"account_update_Mutation":`mutation account_update_Mutation(
		  $photo: URL
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
		    _id: id
		    token
		  }
		}
		`,
	"profile_update_Mutation":`mutation profile_update_Mutation(
		  $photo: URL
		  $username: String
		  $birthday: Date
		  $gender: Gender
		  $location: String
		  $signature: String
		) {
		  user_update(photo: $photo, username: $username, birthday: $birthday, gender: $gender, location: $location, signature: $signature)
		}
		`,
	"qiliQL_account_me_Query":`query qiliQL_account_me_Query {
		  user: me {
		    ...qiliQL_account_user
		    id
		  }
		}
		
		fragment qiliQL_account_user on User {
		  id
		  photo
		  username
		}
		`,
	"qiliQL_account_userProfile_Query":`query qiliQL_account_userProfile_Query {
		  user: me {
		    ...qiliQL_userProfile_user
		    id
		  }
		}
		
		fragment qiliQL_userProfile_user on User {
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