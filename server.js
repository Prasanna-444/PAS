const express = require("express");
require("dotenv").config();
const mongoose = require("mongoose");
const cors = require("cors");



const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// 🔗 Connect routes

const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");
const rackRoutes = require("./routes/rackRoutes");
const exportedRackRoutes = require('./routes/exportedRackRoutes'); 
const masterdescRoutes = require('./routes/master_routes');// NEW
 // New: Import team routes

app.use("/api/auth", authRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/racks", rackRoutes);
app.use('/api/exported-racks-snapshot', exportedRackRoutes); // New: Use team routes
app.use('/api', masterdescRoutes);
// Root route
app.get("/", (req, res) => {
  res.send("Server is running.");
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("MongoDB connected");
  app.listen(process.env.PORT || 5000,'0.0.0.0', () =>
    console.log(`Server running on port ${process.env.PORT || 5000}`)
  );
}).catch((err) => console.error("MongoDB connection error:", err));