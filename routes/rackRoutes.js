const express = require('express');
const {
    createRack,
    getRacks,
    getRackById,
    updateRack,
    deleteRack
} = require('../controllers/rackcontroller');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.route('/')
    .post(protect, authorize(['admin', 'team_leader', 'team_member']), createRack) // Allow TM to create racks as well
    .get(protect,authorize(['admin', 'team_leader', 'team_member']),getRacks); // All authenticated users can get racks

router.route('/:id')
    .get(protect, authorize(['admin', 'team_leader', 'team_member']), getRackById)
    .put(protect, authorize(['admin', 'team_leader']), updateRack)
    .delete(protect, authorize(['admin', 'team_leader']), deleteRack);

module.exports = router;
