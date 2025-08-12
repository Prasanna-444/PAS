// backend/models/ExportedRackSnapshot.js
const mongoose = require('mongoose');

const ExportedRackSnapshotSchema = new mongoose.Schema({
    // Fields directly from the exported Excel view
    sNo: { // Serial Number from the export list
        type: Number,
        required: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    rackNo: {
        type: String,
        required: true,
        trim: true
    },
    partNo: {
        type: String,
        required: true,
        trim: true
    },
    nextQty: { // Renamed from 'Qty' for consistency with Rack model
        type: Number,
        required: true,
        min: 0
    },
    mrp: {
        type: Number,
           required: false,
           default: null,
           min: 0
    },
    ndp: {
        type: Number,
        required: false,
        default:null,
        min: 0
    },
    materialDescription: { // Renamed from 'Material' for consistency
        type: String,
        trim: true,
        default: ''
    },
    
    // Metadata for the snapshot
    exportedAt: {
        type: Date,
        default: Date.now
    },
    // Reference to the original Team/Site this snapshot belongs to
    team: {
        type: mongoose.Schema.ObjectId,
        ref: 'Team',
        required: true
    },
    siteName: { // Denormalized site name for easier querying
        type: String,
        required: true,
        trim: true
    },
    exportedBy: { // Who initiated this export/finish action
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    }
});

// Add an index for faster lookups if you frequently query by team or siteName
ExportedRackSnapshotSchema.index({ team: 1, exportedAt: -1 });
ExportedRackSnapshotSchema.index({ siteName: 1, exportedAt: -1 });

module.exports = mongoose.model('ExportedRack', ExportedRackSnapshotSchema);
