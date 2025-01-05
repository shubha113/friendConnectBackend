import express from 'express';
import { acceptFriendRequest, login, logout, register, sendFriendRequest } from '../controllers/userController.js';
import {isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/logout", logout);
router.post("/request", isAuthenticated, sendFriendRequest);
router.post("/accept", isAuthenticated, acceptFriendRequest);

export default router;