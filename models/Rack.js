const mongoose = require('mongoose');

const RackSchema = new mongoose.Schema({
  rackNo: {
    type: String,
    required: true,
  },
  partNo: {
    type: String,
    required: true,
    index: true,
  },
  mrp: {
    type: Number,
  },
  nextQty: {
    type: Number,
    required: true,
  },
  location: {
    type: String,
    enum: ['ACCESSORIES', 'SPARES'], // Enforce your allowed values
    required: true,
  },
  siteName: {
    type: String,
    required: true,
    index: true,
  },
  scannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },  // <---- Add this field

  // Optional: You can denormalize master description and ndp if needed,
  // but generally better to join at query time
  masterDescription: {
    type: String,
  },
  ndp: {
    type: Number,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});

const Rack = mongoose.model('Rack', RackSchema);

module.exports = Rack;
