import { genAccessToken, genRefreshToken, verifyRefreshToken } from "../config/access-refresh-token.js";
import User from "../models/user.model.js";
import bcrypt from "bcrypt";

/**
 * Register a new user.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Registration data.
 * @param {string} req.body.name - User's full name.
 * @param {string} req.body.email - User's email address.
 * @param {string} req.body.password - User's plain-text password.
 *
 * @returns {Promise<void>}
 */

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const isAreadyExist = await User.findOne({ email });
    if (isAreadyExist) {
      return res.status(400).json({
        message:
          "user with this Email already existed. Please Login with this Email",
      });
    }
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role,
    });

    const refreshToken = genRefreshToken(user._id);
    const accessToken = genAccessToken(user._id);

    await User.findOneAndUpdate({_id:user._id},{refreshToken});

    res.cookie("refresh-token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "User registered successfully!",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role:user.role
      },
      accessToken
    });
  } catch (error) {
    res.status(500).json({
    success:false,
      messsage: "Internal server error",
    });

    console.log(error);
  }
};




/**
 * Login an existing user.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Login credentials.
 * @param {string} req.body.email - User's email address.
 * @param {string} req.body.password - User's plain-text password.
 
 */

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    
   const user = await User.findOne({email}).select("+password")

    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }


    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    
    const accessToken = genAccessToken(user._id);
    const refreshToken = genRefreshToken(user._id);

   
    res.cookie("refresh-token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "User logged in successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      accessToken,
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};






/**
 * Generate a new access token using refresh token.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 *
 * @returns {Promise<void>}
 */
export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not found",
      });
    }

    const decoded = verifyRefreshToken(refreshToken);

    const accessToken = genAccessToken(decoded.userId);

    return res.status(200).json({
      success: true,
      accessToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired refresh token",
    });
  }
};



/**
 * Get the currently authenticated user's data.
 *
 * @route   GET /api/auth/get-me
 * @access  Private
 * @returns Current authenticated user information
 */
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      user: req.user,
    });
  } catch (error) {
    console.error("Error occurred while fetching user:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};





/**
 *? Logout the currently authenticated user.
 *
 * Removes the refresh token from the database
 * and clears the refresh token cookie.
 *
 * @route   POST /api/auth/logout
 * @access  Private
 * @returns Logout confirmation
 */
export const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      {
        refreshToken: null,
      }
    );

    res.clearCookie("refresh-token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "User logged out successfully",
    });
  } catch (error) {
    console.error("Logout Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




/**
 * Update the authenticated user's basic profile.
 *
 * @route    PATCH /api/update-profile
 * @access  Private
 * @body    name, phone, avatar
 * @returns Updated user profile
 */
export const updateUserProfile = async (req, res) => {
  try {
    const allowedFields = ["name", "phone", "avatar"];

    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      {
         returnDocument: "after",
        runValidators: true,
      }
    ).select("-password -refreshToken");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update User Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};