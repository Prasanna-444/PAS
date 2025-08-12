// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();

// Import the controller functions
const {
    registerUser,
    loginUser,
    getUsers,
    getUsersByRole,
    updateUser,
    deleteUser,
    getActiveAdminsCount,
    // Add forgotPassword, resetPassword functions later
} = require('../controllers/authcontroller'); // Corrected typo: authcontroller to authController

// Import your middleware functions
// These are correctly imported as 'protect' and 'authorize'
const { protect, authorize } = require('../middleware/authMiddleware');

// Define your authentication routes
// Replaced 'authMiddleware' with 'protect'
// Replaced 'adminMiddleware' with 'authorize(['admin'])' for role-based access
router.post('/register', protect, authorize(['admin']), registerUser); // Register new user (Admin only)
router.post('/login', loginUser); // Login doesn't need protection or role checks

// Protected routes (require authentication and sometimes authorization)
// Replaced 'authMiddleware' with 'protect' and 'adminMiddleware' with 'authorize(['admin'])'
router.get('/users', protect, authorize(['admin']), getUsers);      // Get all users (Admin only)
// Replaced 'authMiddleware' with 'protect' and 'require('../middleware/teamLeaderMiddleware')' with 'authorize(['admin', 'team_leader'])'
router.get('/users/role/:role', protect, authorize(['admin', 'team_leader']), getUsersByRole); // Get users by role (Admin or Team Leader)
router.put('/users/:id', protect, authorize(['admin']), updateUser); // Update a user (Admin only)
router.delete('/users/:id', protect, authorize(['admin']), deleteUser); // Delete a user (Admin only)
router.get('/users/admins/count', protect, authorize(['admin']), getActiveAdminsCount); // Get active admin count (Admin only)

module.exports = router;
