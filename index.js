const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fpcalbv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const pcbuilderCollection = client.db("theRig").collection("cpu");

    //pcbuilder related api
    app.get("/:pcbuilderProductName/:category", async (req, res) => {
      const category = req.params.category;
      const query = { category: category };
      const result = await pcbuilderCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/:test/replace/:id", async (req, res) => {
      const id = req.params.id;
      console.log("id = ", id);
      const filter = { _id: new ObjectId(id) };

      const result = await pcbuilderCollection.findOne(filter);
      console.log(result);
      res.send(result);
    });

    app.get("/cpu/:collectionName/:name", async (req, res) => {
      const name = req.params.name;
      const query = { name: name };
      // console.log(query);
      const result = await pcbuilderCollection.find(query).toArray();
      // console.log({ result });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("theRig is running");
});

app.listen(port, () => {
  console.log(`theRig is running on port ${port}`);
});
