const mongoose = require('mongoose');

async function listCollections() {
    try {
        await mongoose.connect('mongodb://localhost:27017/indexfast');
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listCollections();
