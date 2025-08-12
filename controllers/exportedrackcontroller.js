// backend/controllers/exportedRackSnapshotController.js
const ExportedRackSnapshot = require('../models/ExportedRack');
const Team = require('../models/Team'); // Needed for validation
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Create multiple exported rack snapshots
// @route   POST /api/exported-racks-snapshot
// @access  Private (Admin, Team Leader)
exports.createExportedSnapshots = asyncHandler(async (req, res, next) => {
    const { snapshots, teamId, siteName } = req.body; // Expect an array of snapshot data, plus teamId and siteName
    const exportedBy = req.user._id; // User who initiated the export

    if (!snapshots || !Array.isArray(snapshots) || snapshots.length === 0) {
        return res.status(400).json({ success: false, message: 'No snapshot data provided.' });
    }
    if (!teamId || !siteName) {
        return res.status(400).json({ success: false, message: 'Team ID and Site Name are required for the snapshot.' });
    }

    // Optional: Validate if the teamId exists and if the user is authorized for this team
    const teamExists = await Team.findById(teamId);
    if (!teamExists) {
        return res.status(404).json({ success: false, message: `Team with ID ${teamId} not found.` });
    }

    const isAuthorized = req.user.role === 'admin' ||
                         (req.user.role === 'team_leader' && teamExists.teamLeader && teamExists.teamLeader.toString() === exportedBy.toString());

    if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'Not authorized to create snapshots for this team.' });
    }

    // Map the incoming snapshots to the schema, adding metadata
    const snapshotsToSave = snapshots.map(snapshot => ({
        sNo: snapshot.sNo,
        location: snapshot.location,
        rackNo: snapshot.rackNo,
        partNo: snapshot.partNo,
        nextQty: snapshot.nextQty,
        mrp: snapshot.mrp,
        ndp: snapshot.ndp,
        materialDescription: snapshot.materialDescription,
        team: teamId,
        siteName: siteName,
        exportedBy: exportedBy
    }));

    try {
        const result = await ExportedRackSnapshot.insertMany(snapshotsToSave);
        res.status(201).json({
            success: true,
            message: `${result.length} rack snapshots saved successfully.`,
            count: result.length
        });
    } catch (error) {
        console.error("Error saving exported rack snapshots:", error);
        res.status(500).json({ success: false, message: 'Server error saving snapshots.' });
    }
});
