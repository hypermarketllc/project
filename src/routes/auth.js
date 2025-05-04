import express from 'express';
import authService from '../lib/auth.js';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    
    // Validate input
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }
    
    // Register the user
    const { user, token } = await authService.register(email, password, fullName);
    
    // Return the user and token
    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Login a user
 * @access Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }
    
    // Login the user
    const { user, token } = await authService.login(email, password);
    
    // Return the user and token
    res.status(200).json({ user, token });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(401).json({ error: error.message || 'Invalid credentials' });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user
 * @access Private
 */
router.get('/me', async (req, res) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Extract the token (Bearer token)
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    // Verify the token
    const decoded = authService.verifyToken(token);
    
    // Get the user from the database
    const user = await authService.getUserById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return the user
    res.status(200).json({ user });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(401).json({ error: error.message || 'Invalid token' });
  }
});

/**
 * @route PUT /api/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.put('/change-password', async (req, res) => {
  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Extract the token (Bearer token)
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    // Verify the token
    const decoded = authService.verifyToken(token);
    
    // Get the current and new passwords from the request body
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Please provide current and new passwords' });
    }
    
    // Change the password
    const success = await authService.changePassword(decoded.id, currentPassword, newPassword);
    
    // Return success
    res.status(200).json({ success });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(400).json({ error: error.message || 'Failed to change password' });
  }
});

export default router;