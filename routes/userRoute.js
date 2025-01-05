import express from 'express';
import { register } from '../controllers/userController.js';
import {isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

router.post("/register", register);

export default router;