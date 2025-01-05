import ErrorHandler from '../utils/errorHandler.js';
import { catchAsyncError } from '../middleware/catchAsyncError.js';
import { sendToken } from '../utils/sendToken.js';
import User from '../models/userModel.js';

export const register = catchAsyncError(async (req, res, next) => {
    const { fullName, username, email, password } = req.body;

    // Validate required fields
    if (!fullName || !username || !email || !password) {
        return next(new ErrorHandler('Please provide all required fields', 400));
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        if (existingUser.email === email) {
            return next(new ErrorHandler('Email already registered', 400));
        }
        if (existingUser.username === username) {
            return next(new ErrorHandler('Username already taken', 400));
        }
    }

    // Create new user
    const user = await User.create({
        fullName,
        username,
        email,
        password
    });

    // Send registration success response without token
    res.status(201).json({
        success: true,
        message: "Registered successfully",
        user: {
            id: user._id,
            fullName: user.fullName,
            username: user.username,
            email: user.email
        }
    });
});
