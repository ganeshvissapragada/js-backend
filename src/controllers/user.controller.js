import {asyncHandler} from"../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
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
      const existedUser=  User.findOne({
        $or:[{username},{email}]
    })
    if(existedUser){
        throw ApiError(409,"user with email or username already exists")
    }

    //images
    const avatarLocalPath= req.files?.avatar[0]?.path;
    const coverImagePath= req.files?.coverImage[0]?.path;
    if(!avatarLocalPath){
         throw new ApiError(400,"Avatar file is required")
    }
    //upload on cloudinary
  const avatar=  await uploadOnCloudinary(avatarLocalPath)
  const coverImage= await uploadOnCloudinary(coverImagePathLocalPath)
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

export{registerUser}