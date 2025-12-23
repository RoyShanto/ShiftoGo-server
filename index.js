const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");
const app = express();
const PORT = process.env.PORT || 7000;


async function run() {
  try {
    const uri = process.env.DB_URL;
    const client = new MongoClient(uri);

    await client.connect();
    console.log("Successfully connected to MongoDB");

    const database = client.db('Shiftogo');
    const parcelsCollection = database.collection('parcels');


    app.post("/parcels", async (req, res) => {
      try {
        const parcel = req.body;
        const result = await parcelsCollection.insertOne(parcel);

        res.status(201).json({
          message: "Parcel saved",
          insertedId: result.insertedId
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to save parcel" });
      }
    });

    app.get("/parcels", async (req, res) => {
      const { email } = req.query;
      const query = email ? { createdBy: email } : {};
      const options = { sort: { createdAt: -1 } }; // 🔽 newest first
      const parcels = await parcelsCollection.find(query, options).toArray();
      res.json(parcels);
    })

    app.delete("/parcels/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await parcelsCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Parcel not found" });
        }

        res.json({ message: "Parcel deleted" });
      } catch (err) {
        res.status(500).json({ message: "Delete failed" });
      }
    });


    // app.get("/parcels", async (req, res) => {
    //   const parcels = await parcelsCollection.find().toArray();
    //   res.json(parcels);
    //   // res.send(parcels);
    // });


  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


// middleware
app.use(cors());
app.use(express.json());

// test route
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
