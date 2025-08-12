const mongoose = require('mongoose');
const Rack = require('../models/Rack');
const Team = require('../models/Team');
const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

// ====================
// Create Rack - accessible by Admin, Team Leader, and Team Member of the team
// ====================
exports.createRack = asyncHandler(async (req, res, next) => {
  const { rackNo, partNo, nextQty, siteName, location } = req.body;

  // Validate required fields
  if (!rackNo || !partNo ||  nextQty === undefined || !siteName || !location) {
    return res.status(400).json({
      success: false,
      message: 'Please provide rackNo, partNo, mrp, nextQty, siteName, and location.',
    });
  }

  // Find the team by siteName
  const team = await Team.findOne({ siteName });
  if (!team) {
    return res.status(404).json({
      success: false,
      message: `Team with siteName '${siteName}' not found.`,
    });
  }

  // Check authorization based on user role and team membership
  const isAdmin = req.user.role === 'admin';
  const isTeamLeader = req.user.role === 'team_leader' && team.teamLeader && team.teamLeader.toString() === req.user._id.toString();
  const isTeamMember = req.user.role === 'team_member' && team.members.some(m => m.toString() === req.user._id.toString());

  if (!(isAdmin || isTeamLeader || isTeamMember)) {
    return res.status(403).json({ success: false, message: 'Not authorized to create rack for this team.' });
  }

  // Optional: prevent duplicate rackNo for the same site
  const existingRack = await Rack.findOne({ partNo, rackNo});
  if (existingRack) {
    return res.status(400).json({ success: false, message: 'PartNumber  already exists for this Rack.' });
  }

  // Create and save the rack, associating the correct teamId and scannedBy user
  const newRack = await Rack.create({
    rackNo,
    partNo,
    nextQty,
    team: team._id,       // Important: associate team id here
    siteName,
    location,
    scannedBy: req.user._id,
  });

  res.status(201).json({
    success: true,
    message: 'Rack created successfully',
    rack: newRack,
  });
});


// ====================
// Get all racks with role-based filtering & optional siteName filtering
// ====================
exports.getRacks = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  const { siteName , teamId} = req.query; // optional siteName filter

  let teamIds = [];
  const matchFilter = {};
  if (req.user.role === 'admin') {
    if(teamId) {
      matchFilter.team = new mongoose.Types.ObjectId(teamId); // Filter for admin if requested
      }
    // Admin: no filter needed, all racks returned
  } else if (req.user.role === 'team_leader') {
    // Find teams led by the user
    const teamsLed = await Team.find({ teamLeader: req.user._id }).select('_id');
    teamIds = teamsLed.map(t => t._id);

    if (teamIds.length === 0) {
      // User leads no teams, return empty result
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
  } else if (req.user.role === 'team_member') {
    // Find teams where the user is a member
    const teamsMemberOf = await Team.find({ members: req.user._id }).select('_id');
    teamIds = teamsMemberOf.map(t => t._id);

    if (teamIds.length === 0) {
      // User not a member of any team - no racks visible
      return res.status(200).json({ success: true, count: 0, data: [] });
    }
  } else {
    // Other roles not authorized
    return res.status(403).json({ success: false, message: 'Not authorized to view racks.' });
  }

  // Build Mongo match filter
  

  // Add team filter for non-admin users
  if (req.user.role !== 'admin') {
    matchFilter.team = { $in: teamIds };
  }

  // Add optional siteName filter if requested
  if (siteName) {
    matchFilter.siteName = siteName;
  }

  // Debug logging (remove or comment out in production)
  console.log(`[getRacks] User: ${req.user._id.toString()}, Role: ${req.user.role}, Filter:`, matchFilter);

  // Aggregate with lookups for material, team, and scannedBy user info
  const racks = await Rack.aggregate([
    { $match: matchFilter },

    // Join material descriptions on partNo
    {
      $lookup: {
        from: 'masterdescriptions',
        localField: 'partNo',
        foreignField: 'partNo',
        as: 'materialData',
      },
    },
    { $unwind: { path: '$materialData', preserveNullAndEmptyArrays: true } },

    {
      $addFields: {
        materialDescription: '$materialData.description',
        ndp: '$materialData.ndp',
        mrp:'$materialData.mrp'
      },
    },
    { $project: { materialData: 0 } },

    // Join team details
    {
      $lookup: {
        from: 'teams',
        localField: 'team',
        foreignField: '_id',
        as: 'team',
      },
    },
    { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },

    // Join scannedBy user details
    {
      $lookup: {
        from: 'users',
        localField: 'scannedBy',
        foreignField: '_id',
        as: 'scannedBy',
      },
    },
    { $unwind: { path: '$scannedBy', preserveNullAndEmptyArrays: true } },

    // Sort by most recent
    { $sort: { createdAt: -1 } },
  ]);

  res.status(200).json({
    success: true,
    count: racks.length,
    data: racks,
  });
});


// ====================
// Get single rack by ID (with permission check)
// ====================
exports.getRackById = asyncHandler(async (req, res, next) => {
  const rackId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(rackId)) {
    return res.status(400).json({ success: false, message: 'Invalid Rack ID.' });
  }

  // Perform aggregation to join materialdesc, team, and scannedBy details
  const racks = await Rack.aggregate([
    { $match: { _id: mongoose.Types.ObjectId(rackId) } },

    // Join material descriptions
    {
      $lookup: {
        from: 'masterdescriptions',
        localField: 'partNo',
        foreignField: 'partNo',
        as: 'materialData',
      },
    },
    { $unwind: { path: '$materialData', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        materialDescription: '$materialData.description',
        ndp: '$materialData.ndp',
        mrp:'$materialData.mrp'
      },
    },
    { $project: { materialData: 0 } },

    // Join team details
    {
      $lookup: {
        from: 'teams',
        localField: 'team',
        foreignField: '_id',
        as: 'team',
      },
    },
    { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },

    // Join scannedBy user details
    {
      $lookup: {
        from: 'users',
        localField: 'scannedBy',
        foreignField: '_id',
        as: 'scannedBy',
      },
    },
    { $unwind: { path: '$scannedBy', preserveNullAndEmptyArrays: true } }
  ]);

  if (!racks.length) {
    return res.status(404).json({ success: false, message: 'Rack not found.' });
  }
  const rack = racks[0];

  const userIdStr = req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  const isTeamLeader = rack.team && rack.team.teamLeader && rack.team.teamLeader.toString() === userIdStr;
  const isTeamMember = rack.team && rack.team.members && rack.team.members.some(m => m.toString() === userIdStr);

  if (!(isAdmin || isTeamLeader || isTeamMember)) {
    return res.status(403).json({ success: false, message: 'Not authorized to view this rack.' });
  }

  res.status(200).json({ success: true, data: rack });
});


// ====================
// Update rack (only admin or team leader of assigned team)
// ====================
exports.updateRack = asyncHandler(async (req, res, next) => {
  const rackId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(rackId)) {
    return res.status(400).json({ success: false, message: 'Invalid Rack ID.' });
  }

  let rack = await Rack.findById(rackId).populate('team', 'teamLeader');

  if (!rack) {
    return res.status(404).json({ success: false, message: 'Rack not found.' });
  }

  const userIdStr = req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  const isTeamLeader = rack.team && rack.team.teamLeader && rack.team.teamLeader.toString() === userIdStr;

  if (!(isAdmin || isTeamLeader)) {
    return res.status(403).json({ success: false, message: 'Not authorized to update this rack.' });
  }

  try {
    rack = await Rack.findByIdAndUpdate(rackId, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Rack updated successfully',
      data: rack,
    });
  } catch (error) {
    console.error('Error updating rack:', error);
    res.status(500).json({ success: false, message: 'Server error updating rack.' });
  }
});


// ====================
// Delete rack (only admin or team leader of assigned team)
// ====================
exports.deleteRack = asyncHandler(async (req, res, next) => {
  const rackId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(rackId)) {
    return res.status(400).json({ success: false, message: 'Invalid Rack ID.' });
  }

  let rack = await Rack.findById(rackId).populate('team', 'teamLeader');

  if (!rack) {
    return res.status(404).json({ success: false, message: 'Rack not found.' });
  }

  const userIdStr = req.user._id.toString();
  const isAdmin = req.user.role === 'admin';
  const isTeamLeader = rack.team && rack.team.teamLeader && rack.team.teamLeader.toString() === userIdStr;

  if (!(isAdmin || isTeamLeader)) {
    return res.status(403).json({ success: false, message: 'Not authorized to delete this rack.' });
  }

  try {
    await rack.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Rack deleted successfully',
      data: {},
    });
  } catch (error) {
    console.error('Error deleting rack:', error);
    res.status(500).json({ success: false, message: 'Server error deleting rack.' });
  }
});
