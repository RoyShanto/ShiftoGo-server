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

    const admin = require("firebase-admin");
    const serviceAccount = require("./firebase-admin-key.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    const verifyFBToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.split(" ")[1];

      try {
        const decodedUser = await admin.auth().verifyIdToken(token);
        req.user = decodedUser; // email, uid
        next();
      } catch (error) {
        return res.status(401).json({ message: "Invalid token" });
      }
    };



    const database = client.db('Shiftogo');
    const usersCollection = database.collection('users');
    const parcelsCollection = database.collection('parcels');
    const ridersCollection = database.collection('riders');


    app.post("/riders", async (req, res) => {
      try {
        const rider = req.body
        const { email } = req.body;
        const userExists = await ridersCollection.findOne({ email });
        if (userExists) {
          return res.status(200).json({ message: "You already a rider", inserted: false });
        }
        const result = await ridersCollection.insertOne(rider);
        res.status(201).json({ message: "Rider created", inserted: true, insertedId: result.insertedId });

      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to rider registration" });
      }
    })

    app.get("/riders", verifyFBToken, async (req, res) => {
      const riders = await ridersCollection.find().toArray();
      res.json(riders);
    })

    app.patch("/riders/:id/status", async (req, res) => {
      const { id } = req.params;
      const { status, email } = req.body;
      const role = "rider";
      // const role = status === "activate" ? "rider" : "user";

      const result = await ridersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      const result2 = await usersCollection.updateOne(
        { email },
        { $set: { role } }
      );

      res.send(result);
    });

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const { email } = user;
        const userExists = await usersCollection.findOne({ email });
        if (userExists) {
          await usersCollection.updateOne({ email }, { $set: { lastLogin: new Date().toISOString() } });
          return res.status(200).json({ message: "User already exists, login time updated", inserted: false });
        }

        // ✅ Only runs if user does NOT exist
        const result = await usersCollection.insertOne(user);
        res.status(201).json({ message: "User created", inserted: true, insertedId: result.insertedId });

      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to save user" });
      }
    });


    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.json(users);
    })

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email }, { projection: { role: 1 } });
      res.send(user || { role: "user" });
    });

    app.patch("/users/:id", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;

      // if (!["admin", "user"].includes(role)) {
      //   return res.status(400).send({ message: "Invalid role" });
      // }

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );

      res.send(result);
    });

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

    app.get("/parcels", verifyFBToken, async (req, res) => {
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
