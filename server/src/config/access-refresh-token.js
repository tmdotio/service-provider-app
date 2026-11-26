import jwt from "jsonwebtoken";
import crypto from "node:crypto";

export const genAccessToken = (userId) =>{
  return jwt.sign({userId},process.env.ACCESS_TOKEN_SECRETE
    ,{
        expiresIn:"15m"
    })

}

export const genRefreshToken = (userId) => {
    // jwtid makes every token unique. Without it, two tokens made in
    // the same second are identical and rotation would not work.
    return jwt.sign({userId},process.env.REFRESH_TOKEN_SECRETE
        ,{
        expiresIn:"7d",
        jwtid: crypto.randomUUID(),
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