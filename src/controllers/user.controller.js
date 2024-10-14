import {asyncHandler} from"../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
const generateAccessAndRefreshToken=async (userId) => {
  try {
    const user=await User.findById(userId)
    const accessToken=user.generateAccessToken()
    const refreshToken=user.generateRefreshToken()
    user.refreshToken=refreshToken
   await user.save({validateBeforeSave:false})
   return{accessToken,refreshToken}
  } catch (error) {
    console.log(error)
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
   if(!username&&!email){
    throw new ApiError(400,"Username or email required")
   }
  const user=  await User.findOne({
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
   //generating tokens
   const{accessToken,refreshToken}= await generateAccessAndRefreshToken(user._id)
  const loggedInUser= await User.findById(user._id).select("-password -refreshToken")
//sending cookies
const options ={
  httpOnly:true,
  secure:true
}   
   return res
   .status(200)
   .cookie("accessToken",accessToken,options)
   .cookie("refreshToken",refreshToken,options)
   .json(
    new ApiResponse(
      200,{
        user:loggedInUser,accessToken,refreshToken
      },
      "User Logged in Sucessfully"
    )
   )
})
const logoutUser=asyncHandler(async(req,res)=>{
  await User.findByIdAndUpdate(
  req.user._id,{
   //updating db
    $set:{
      refreshToken:undefined
    }
  },{
    new:true
  }
)
const options ={
  httpOnly:true,
  secure:true
}
return res
.status(200)
.clearCookie("accessToken",options)
.clearCookie("refreshToken",options)
.json(new ApiResponse(200,{},"user LoggedOut successfully"))
})

const refreshAccessToken= asyncHandler(async(req,res)=>{
const incomingRefreshToken =req.cookies.refreshToken || req.body.refreshToken
if(!incomingRefreshToken){
  throw new ApiError(401,"unathorized request")
}
try {
   const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
     )
    const user= await User.findById(decodedToken?._id)
    if(!user){
      throw new ApiError(401,"Invalid Refresh Token")
    }
    if(incomingRefreshToken!==user?.refreshToken){
      throw new ApiError(401,"Refresh Token is Expired or used")
    }
    const options={
      httpOnly:true,
      secure:true
    }
    const{accessToken,newRefreshToken}= await generateAccessAndRefreshToken(user._id)
     return res
     .status(200)
     .cookie("accessToken",accessToken,options)
     .cookie("refreshToken",newRefreshToken,options)
     .json(
      new ApiResponse(
        200,
        {accessToken,newRefreshToken},
        "Access refreshed sucessfully"
      )
     )
} catch (error) {
  throw new ApiError(401,"refresh Token invalid")
}
})

const changeCurrentPassword= asyncHandler(async(req,res)=>{
  const{oldPassword,newPassword}=req.body
  const user=await User.findById(req.user?._id)
 const isPasswordCorrect= await user.isPasswordCorrect(oldPassword)
  if(!isPasswordCorrect){
    throw new ApiError(400,"invalid password")
  }
  user.password=newPassword
   await user.save({validateBeforeSave:false})
return res
.status(200)
.json( new ApiResponse(
  200,
  {},
  "password changed successfully"
))
})
const getCurrentUser= asyncHandler(async(req,res)=>{
  return res
  .status(200)
  .json(200,req.user,"user fetched successfully")
})
const updateUserDetails=asyncHandler(async(req,res)=>{
  const{fullname,email}=req.body
  if(!fullname||!email){
    throw new ApiError(400,"feilds are required")
  }
  const user= User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        fullname,
        email
      }
    },{new:true //returns updated information
    }
  ).select("-password")
  return res
  .status(200)
  .json(new ApiResponse(200,user,"account details changed sucessfylly"))
})
const updateUserAvatar=asyncHandler(async(req,res)=>{
  const avatarLocalPath=req.file?.path
  if(!avatarLocalPath){
    return new ApiError(400,"Avatar file is missing")
  }
  const avatar= await uploadOnCloudinary(avatarLocalPath)
  if(!avatar.url){
    return new ApiError(400,"error while uploading on avatar")
     }
      const user=await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set:{
          avatar:avatar.url
        }
      },{
        new:true
      }
     ).select("-password")
     return res
     .status(200)
     .json(
      new ApiResponse(200,user,"avatar changed successfully")
     )
})
const updateCoverImage=asyncHandler(async(req,res)=>{
  const coverImageLocalPath=req.file?.path
  if(!coverImageLocalPath){
    return new ApiError(400,"coverImage file is missing")
  }
  const coverImage= await uploadOnCloudinary(coverImageLocalPath)
  if(!coverImage.url){
    return new ApiError(400,"error while uploading on avatar")
     }
      const user=await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set:{
          coverImage:coverImage.url
        }
      },{
        new:true
      }
     ).select("-password")
     return res
     .status(200)
     .json(
      new ApiResponse(200,user,"coverImage changed successfully")
     )
})
export{
  registerUser,
   loginUser,
   logoutUser,
   refreshAccessToken,
   changeCurrentPassword,
   getCurrentUser,
   updateUserDetails,
   updateUserAvatar,
   updateCoverImage
}