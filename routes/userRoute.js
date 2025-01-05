import express from 'express';
import { acceptFriendRequest, getFriendRecommendations, login, logout, register, searchUsers, sendFriendRequest } from '../controllers/userController.js';
import {isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/logout", logout);
router.post("/request", isAuthenticated, sendFriendRequest);
router.post("/accept", isAuthenticated, acceptFriendRequest);
router.get('/search', isAuthenticated, searchUsers);
router.get('/recommendations', isAuthenticated, getFriendRecommendations);

export default router;