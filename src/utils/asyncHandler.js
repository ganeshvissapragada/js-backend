const asyncHandler=(requesthandler)=>{
    (req,res,next)=>{
        Promise.resolve(requesthandler(req,res,next)).catch((err) => next(err))
    }
}









export{asyncHandler}

/*try catch method
// const asyncHandler=(fn)=> async (req,res,next)=>{
//     try {
//         await fn(req,res,next)
        
//     } catch (error) {
//         res.status(err.code||500).json({
//             sucess: false,
//             message:err.message
//         })
//     }
// }*/