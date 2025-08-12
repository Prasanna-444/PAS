// backend/controllers/authController.js
const User = require('../models/User');
const Team = require('../models/Team'); // Make sure to import Team model
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Make sure to import bcryptjs for password hashing
require('dotenv').config();
const asyncHandler = require('../middleware/asyncHandler'); // NEW: Import asyncHandler

// Helper function to generate JWT token (ensure this is defined if not globally)
const generateToken = (id, role) => { // Added 'role' to token payload for authorization checks
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '1h', // Token expires in 1 hour
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Admin only
// MODIFIED: Wrapped with asyncHandler
exports.getActiveAdminsCount = asyncHandler(async (req, res) => {
    try {
        const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
        return res.status(200).json({ success: true, count: adminCount });
    } catch (error) {
        console.error('Error fetching active admin count:', error);
        return res.status(500).json({ success: false, message: 'Server error fetching admin count.' });
    }
});

// MODIFIED: Wrapped with asyncHandler
exports.registerUser = async (req, res) => {
  const { name, email, password, role, isActive } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: "Please enter all required fields: name, email, password, role" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User with this email already exists" });
    }

    const user = new User({
      name,
      email,
      password,   // Will be hashed by pre-save hook
      role,
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    console.error("Register error stack:", err.stack);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Email already registered." });
    }
    res.status(500).json({ success: false, message: "Server error during registration." });
  }
};


// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// MODIFIED: Wrapped with asyncHandler
exports.loginUser = asyncHandler(async (req, res) => {
    console.log('Login request received:', req.body);

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    try {
        // +select('+password') is crucial because password is set to select: false in schema
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Compare hashed password
        const isMatch = await bcrypt.compare(password, user.password); // Use bcrypt.compare
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        if (!user.isActive) {
            return res.status(403).json({ success: false, message: "Account is inactive. Please contact admin." });
        }

        console.log('User found from DB:', user);
        console.log('User isActive status:', user.isActive);

        const token = generateToken(user._id, user.role); // Pass role to generateToken

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token: token,
            user: {
                id: user._id, // Use 'id' for Flutter frontend
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
            },
        });
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
// @access  Private (Admin)
// MODIFIED: Wrapped with asyncHandler
exports.getUsers = asyncHandler(async (req, res) => {
    try {
        const users = await User.find({}).select("-password"); // Fetch all users, exclude passwords
        res.status(200).json({ success: true, users: users });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ success: false, message: "Server error fetching users" });
    }
});

// @desc    Get users by role (e.g., only 'team_member' for team assignment)
// @route   GET /api/auth/users/role/:role
// @access  Private (Admin, Team Leader) - Team Leader can only request 'team_member' role
// MODIFIED: Wrapped with asyncHandler
exports.getUsersByRole = asyncHandler(async (req, res) => {
    const targetRole = req.params.role;

    // Authorization check for Team Leaders (assuming req.user is populated by authMiddleware)
    if (req.user.role === 'team_leader' && targetRole !== 'team_member') {
        return res.status(403).json({ success: false, message: "Team Leaders can only fetch 'team_member' users." });
    }

    try {
        let users;
        if (targetRole === 'team_member') {
            // Find all active teams
            const activeTeams = await Team.find({ status: 'active' });

            // Extract IDs of all team members currently in active teams
            const membersInActiveTeams = activeTeams.flatMap(team => team.members);

            // Find 'team_member' users who are active (globally) AND not in any active team
            users = await User.find({
                role: targetRole,
                isActive: true, // Only consider globally active users
                _id: { $nin: membersInActiveTeams } // Exclude members already in active teams
            }).select("-password");

        } else {
            // For other roles (e.g., 'admin', 'team_leader'), just fetch as before
            users = await User.find({ role: targetRole, isActive: true }).select("-password");
        }

        res.status(200).json({ success: true, users: users });
    } catch (error) {
        console.error(`Error fetching users with role ${targetRole}:`, error);
        res.status(500).json({ success: false, message: `Server error fetching users with role ${targetRole}` });
    }
});

// @desc    Update a user (Admin only)
// @route   PUT /api/auth/users/:id
// @access  Private (Admin)
// MODIFIED: Wrapped with asyncHandler
exports.updateUser = asyncHandler(async (req, res) => {
    const { name, email, role, isActive, password } = req.body; // Include password if it can be updated

    try {
        const user = await User.findById(req.params.id).select('+password'); // Select password to potentially hash if updated
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Prevent changing admin status from non-admin
        if (user.role === 'admin' && req.body.role !== 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Only an admin can demote another admin." });
        }

        user.name = name || user.name;
        user.email = email || user.email;
        user.role = role || user.role;
        user.isActive = (isActive !== undefined) ? isActive : user.isActive;

        // If password is provided, update it (pre-save hook will hash it)
        if (password) {
            user.password = password;
        }

        const updatedUser = await user.save();
        // Return user without password
        res.status(200).json({
            success: true,
            message: "User updated successfully",
            user: {
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                isActive: updatedUser.isActive
            }
        });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ success: false, message: "Server error updating user" });
    }
});

// @desc    Delete a user (Admin only)
// @route   DELETE /api/auth/users/:id
// @access  Private (Admin)
// MODIFIED: Wrapped with asyncHandler
exports.deleteUser = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (user.role === 'admin') {
            const activeAdminsCount = await User.countDocuments({ role: 'admin', isActive: true });
            if (activeAdminsCount <= 1 && user.isActive) {
                return res.status(403).json({ success: false, message: 'Cannot delete the last active administrator account.' });
            }
        }
        // Prevent admin from deleting themselves
        if (req.user.id === req.params.id) {
            return res.status(403).json({ success: false, message: "Cannot delete your own account." });
        }
        // Prevent admin from deleting other admins directly (optional, but good practice)
        if (user.role === 'admin' && req.user.role === 'admin' && req.user.id !== user._id.toString()) { // Ensure not deleting self
            return res.status(403).json({ success: false, message: "Admins cannot delete other admin accounts directly. Consider demoting first." });
        }

        await User.deleteOne({ _id: req.params.id });
        res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ success: false, message: "Server error deleting user" });
    }
});

// TODO: Implement forgotPassword and resetPassword functions here later
