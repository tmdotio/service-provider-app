import jwt from "jsonwebtoken";

export const genAccessToken = (userId) =>{
  return jwt.sign({userId},process.env.ACCESS_TOKEN_SECRETE
    ,{
        expiresIn:"15m"
    })

}

export const genRefreshToken = (userId) => {
    return jwt.sign({userId},process.env.REFRESH_TOKEN_SECRETE
        ,{
        expiresIn:"7d"
    })
}


export const verifyRefreshToken = (token) => {
  return jwt.verify(
    token,
    process.env.REFRESH_TOKEN_SECRETE
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SECRETE
  );
};