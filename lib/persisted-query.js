//generated from persisted-query.js, don't edit it
module.exports={
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
	"file_token_Mutation":`mutation file_token_Mutation(
		  $key: String
		) {
		  file_token(key: $key) {
		    token
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
	"main_userProfile_me_Query":`query main_userProfile_me_Query {
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