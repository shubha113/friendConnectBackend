import ErrorHandler from '../utils/errorHandler.js';
import { catchAsyncError } from '../middleware/catchAsyncError.js';
import { sendToken } from '../utils/sendToken.js';
import User from '../models/userModel.js';
import { Error } from 'mongoose';

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


export const login = catchAsyncError(async (req, res, next) => {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
        return next(new ErrorHandler('Please provide email and password', 400));
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
        return next(new ErrorHandler('Invalid email or password', 401));
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        return next(new ErrorHandler('Invalid email or password', 401));
    }

    // Send token in response
    sendToken(res, user, "Logged in successfully");
});


export const logout = catchAsyncError(async (req, res, next) => {
    // Clear the token cookie
    res.status(200)
        .cookie('token', null, {
            expires: new Date(Date.now()),
            httpOnly: true,
            secure: true,
            sameSite: "none",
        })
        .json({
            success: true,
            message: 'Logged out successfully'
        });
});


export const sendFriendRequest = catchAsyncError (async(req, res, next)=>{
    const { friendId } = req.body;
    const userId = req.user.id;

    if(!friendId){
        return next( new ErrorHandler("Please provide friend ID", 400));
    }

    if(friendId === userId){
        return next ( new ErrorHandler("You cannot send friend request to yourself", 400));
    }

    const [user, friend] = await Promise.all([User.findById(userId), User.findById(friendId)]);

    if(!friend) {
        return next (new ErrorHandler("User not found", 404));
    }

    //check if they are already friends
    if(user.friends.includes(friendId)){
        return next(new ErrorHandler("You are already friend with this user", 400));
    }

    const existingRequest = friend.friendRequests.find(
        request => request.from.toString() === userId.toString()
    );

    if(existingRequest){
        return next(new ErrorHandler("Friend request already sent", 400));
    }

    friend.friendRequests.push({from: userId, status: 'pending'});

    await friend.save();
    res.status(200).json({
        success: true,
        message: 'Friend request sent successfully'
    });
});


export const acceptFriendRequest = catchAsyncError(async (req, res, next) => {
    const { requestId } = req.body;
    const userId = req.user.id;

    if (!requestId) {
        return next(new ErrorHandler('Please provide request ID', 400));
    }

    // Find the current user
    const user = await User.findById(userId);
    const request = user.friendRequests.id(requestId);

    if (!request) {
        return next(new ErrorHandler('Friend request not found', 404));
    }

    if (request.status !== 'pending') {
        return next(new ErrorHandler('Friend request already processed', 400));
    }

    // Update request status and add to friends list
    request.status = 'accepted';
    user.friends.push(request.from);
    
    await user.save();

    // Update the friend's friends list
    await User.findByIdAndUpdate(request.from, {
        $push: { friends: userId }
    });

    res.status(200).json({
        success: true,
        message: 'Friend request accepted successfully'
    });
});


export const searchUsers = catchAsyncError(async (req, res, next) => {
    const { query } = req.query;
    const currentUser = req.user.id;

    if (!query) {
        return next(new ErrorHandler('Please provide a search query', 400));
    }

    // Search for users whose username, email, or full name matches the query
    const users = await User.find({
        $and: [
            { _id: { $ne: currentUser } },
            {
                $or: [
                    { username: { $regex: query, $options: 'i' } }, 
                    { email: { $regex: query, $options: 'i' } }, 
                    { fullName: { $regex: query, $options: 'i' } }
                ]
            }
        ]
    }).select('fullName username email');

    if (users.length === 0) {
        return next(new ErrorHandler('No users found matching the query', 404));
    }

    res.status(200).json({
        success: true,
        count: users.length,
        data: users
    });
});


export const getFriendRecommendations = catchAsyncError(async (req, res, next) => {
    const userId = req.user.id;
    
    // Get current user's friends
    const user = await User.findById(userId).populate('friends');
    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }
    
    const userFriends = user.friends.map(friend => friend._id);
    
    // Get recommendations based on mutual friends
    const recommendations = await User.aggregate([
        {
            $match: {
                _id: { $nin: [...userFriends, user._id] }
            }
        },
        // Look up their friends list
        {
            $lookup: {
                from: 'users',
                localField: 'friends',
                foreignField: '_id',
                as: 'theirFriends'
            }
        },
        // Calculate mutual friends count
        {
            $addFields: {
                mutualFriendsCount: {
                    $size: {
                        $setIntersection: ['$theirFriends._id', userFriends]
                    }
                }
            }
        },
        {
            $match: {
                mutualFriendsCount: { $gt: 0 }
            }
        },
        {
            $sort: { mutualFriendsCount: -1 }
        },
        {
            $limit: 5
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                email: 1,
                mutualFriendsCount: 1
            }
        }
    ]);

    res.status(200).json({
        success: true,
        count: recommendations.length,
        data: recommendations.map(rec => ({
            ...rec,
            recommendationReason: `${rec.mutualFriendsCount} mutual friend${rec.mutualFriendsCount > 1 ? 's' : ''}`
        }))
    });
});


// Add this to your existing controllers file

export const getMyProfile = catchAsyncError(async (req, res, next) => {
    const userId = req.user.id;

    const user = await User.findById(userId)
        .select('-password -friendRequests')
        .populate('friends', 'fullName username email');

    if (!user) {
        return next(new ErrorHandler('User not found', 404));
    }

    res.status(200).json({
        success: true,
        data: {
            _id: user._id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            friends: user.friends,
            createdAt: user.createdAt
        }
    });
});
