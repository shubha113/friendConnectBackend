import jwt from "jsonwebtoken";
import ErrorHandler from "../utils/errorHandler.js";
import User from "../models/userModel.js";

export const isAuthenticated = async (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
        return next(new ErrorHandler("Not authenticated", 401));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await User.findById(decoded.id);

        if (!user) {
            return next(new ErrorHandler("User not found", 404));
        }

        req.user = user; 
        next();
    } catch (error) {
        return next(new ErrorHandler("Invalid token", 401));
    }
};