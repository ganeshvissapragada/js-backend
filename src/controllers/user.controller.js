import {asyncHandler} from"../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
const generateAcessAndRefreshToken=async (userId) => {
  try {
    const user=await User.findById(userId)
    const accessToken=user.generateAccessToken()
    const refreshToken=user.generateRefreshToken()
    user.refreshToken=refreshToken
   await user.save({validateBeforeSave:false})
   return{accessToken,refreshToken}
  } catch (error) {
    throw new ApiError(500,"someThing went Wrong  while generating AcessAndRefreshToken")
  }
}

const registerUser=asyncHandler(async (req,res)=>{
    //take input from frontend
    const{fullname,email,username,password}=req.body
    console.log("email is:" ,email);
   //validate details
    if(
        [fullname,email,username,password].some((feild)=>feild?.trim()==="")
    ){
      throw new ApiError(400,"All fields are required")
    }
      const existedUser= await User.findOne({
        $or:[{username},{email}]
    })
    if(existedUser){
        throw new ApiError(409,"user with email or username already exists")
    }

    //images
    const avatarLocalPath= req.files?.avatar[0]?.path;
    // const coverImageLocalPath= req.files?.coverImage[0]?.path;
     let coverImageLocalPath;
     if(req.files && Array.isArray(req.files.coverImage)&&req.files.coverImage.length>0){
      coverImageLocalPath=req.files.coverImage[0].path
     }

    if(!avatarLocalPath){
         throw new ApiError(400,"Avatar file is required")
    }
    //upload on cloudinary
  const avatar=  await uploadOnCloudinary(avatarLocalPath)
  const coverImage= await uploadOnCloudinary(coverImageLocalPath)
  if(!avatar){
    throw new ApiError(400,"Avatar file is required")
  }
  //creating user object in db
   const user=await User.create({
    fullname,
    avatar:avatar.url,
    coverImage:coverImage?.url||"",
    email,
    password,
    username:username.toLowerCase()
  })
  //checking user is created
  const createdUser= await User.findById(user._id).select(
    "-password -refreshToken"
  )
  if(!createdUser){
    throw new ApiError(500,"someThing went Wrong While Registering the user")
  }
  //response to user
  return res.status(201).json(
    new ApiResponse(200,createdUser,"User registered succesfully")
  )

})

const loginUser=asyncHandler(async(req,res)=>{
  //getting data from frontend
   const {email,username,password}=req.body
   //validating email||username
   if(!username||!email){
    throw new ApiError(400,"Username or email required")
   }
  const user=  await User.find({
    $or:[{username},{email}]
   })
   if(!user){
    throw new ApiError(404,"User doesn't Exist")
   }
   //validating password
  const isPasswordVaild = await user.isPasswordCorrect(password) //we should use userobject we created to call local methods not User which is used for db methods
  if(!isPasswordVaild){
    throw new ApiError(401,"Invalid User Credentials")
   }
   const{accessToken,refreshToken}=await
   generateAcessAndRefreshToken(user._id)

   //paused at 27:00 min vide0 -15
   
})

export{
  registerUser,
   loginUser
}