const express = require('express');
const path = require('path');
const { connectToServer, getDb } = require('./db');

const app = express();
const PORT = 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// get stations, optionally filtered by commune and status, enriched with nearby toilets
app.get('/api/stations', async (req, res) => {
    try {
        const db = getDb();
        const communeFilter = req.query.commune;
        const statusFilter = req.query.status;

        const matchStage = {};
        if (communeFilter) matchStage.commune = communeFilter;
        if (statusFilter && statusFilter !== 'ALL') matchStage.status = statusFilter;

        const stations = await db.collection('velov2026').aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: 'toilets',
                    let: { loc: '$geometry' },
                    pipeline: [
                        {
                            $geoNear: {
                                near: '$$loc',
                                distanceField: 'dist',
                                maxDistance: 200,
                                spherical: true
                            }
                        }
                    ],
                    as: 'nearby_toilets'
                }
            },
            {
                $project: {
                    _id: 0,
                    name: 1,
                    commune: 1,
                    available_bikes: 1,
                    toilets_count: { $size: '$nearby_toilets' }
                }
            }
        ]).toArray();

        res.json(stations);
    } catch (err) {
        res.status(500).send("database error");
    }
});

// get all commune names
app.get('/api/communes', async (req, res) => {
    try {
        const db = getDb();
        const communes = await db.collection('velov2026').distinct("commune");
        res.json(communes);
    } catch (err) {
        res.status(500).send("database error");
    }
});

// get stats per commune: nb stations + avg available bikes
app.get('/api/communes/stats', async (req, res) => {
    try {
        const db = getDb();
        const stats = await db.collection('velov2026').aggregate([
            { $group: { _id: "$commune", nbStations: { $sum: 1 }, avgBikes: { $avg: "$available_bikes" } } },
            { $project: { _id: 0, commune: "$_id", nbStations: 1, avgBikes: { $round: ["$avgBikes", 1] } } }
        ]).toArray();
        res.json(stats);
    } catch (err) {
        res.status(500).send("database error");
    }
});

// get stations filtered by status
app.get('/api/status_filtered_stations', async (req, res) => {
    try {
        const status = req.query.status;
        const db = getDb();
        const collection = db.collection("velov2026");
        let filter = {};
        if (status) {
            filter.status = status;
        }
        const stations = await collection
            .find(filter, { projection: { name: 1, status: 1, _id: 0 } })
            .toArray();
        res.json(stations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fetch error in status_filtered_stations" });
    }
});

// Boot sequence: connect to DB then start server
connectToServer().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
});