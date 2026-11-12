const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const truckRoutes = require('./routes/truckRoutes');
const tripRoutes = require('./routes/tripRoutes');

const app = express();
app.use(express.json());
app.use(cors());

// Routes Setup
app.use('/api/auth', authRoutes);
app.use('/api/trucks', truckRoutes);
app.use('/api/trips', tripRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`D2-Transport backend server running on port ${PORT}`);
});