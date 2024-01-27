const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
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

const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const pcbuilderCollection = client.db("theRig").collection("cpu");
    const cartCollection = client.db("theRig").collection("cart");
    const pcbuilderCartCollection = client
      .db("theRig")
      .collection("pcbuilderCart");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      console.log({ user });
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      console.log(token);
      res.send({ token });
    });

    app.get("/cpu", verifyJwt, async (req, res) => {
      console.log("authorization success");
      const query = req.body;
      const result = await pcbuilderCollection.find(query).toArray();
      res.send(result);
    });

    //This api is created for searchbar
    app.get("/products", async (req, res) => {
      const search = req.query.search;

      const query = { name: { $regex: search, $options: "i" } };

      const result = await pcbuilderCollection.find(query).toArray();

      res.send(result);
    });

    // Assuming you have your Express app and MongoDB connection set up

    // Define your route for fetching a single product by ID
    app.get("/products/:productId", async (req, res) => {
      try {
        const productId = req.params.productId;

        // Assuming you have a unique identifier for your products, replace "_id" with your actual identifier

        const query = { _id: new ObjectId(productId) };
        const product = await pcbuilderCollection.findOne(query);

        console.log({ product, query, productId });
        if (!product) {
          return res.status(404).json({ error: "Product not found" });
        }

        res.json(product);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Example request: GET /products/12345

    app.get("/:test/replace/:id", async (req, res) => {
      const id = req.params.id;
      // console.log("id = ", id);
      const filter = { _id: new ObjectId(id) };
      const result = await pcbuilderCollection.findOne(filter);
      // console.log(result);
      res.send(result);
    });

    app.get("/cpu/:collectionName/:name", async (req, res) => {
      const name = req.params.name;
      const query = { name: name };
      const result = await pcbuilderCollection.find(query).toArray();
      res.send(result);
    });

    //====================pcbuilderCart related api=========================

    app.post("/pcbuilderCart", async (req, res) => {
      const query = req.body;
      console.log({ query });
      const result = await pcbuilderCartCollection.insertOne(query);
      res.send(result);
    });

    app.get("/pcbuilderCart", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      // const query = req.body;
      const result = await pcbuilderCartCollection.find(query).toArray();
      res.send(result);
    });

    //Note: This api was created for ReplaceProduct.jsx file. apatoto ata kono drkar nai....
    // app.get("/pcbuilderCart/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const filter = { _id: new ObjectId(id) };
    //   const result = await pcbuilderCartCollection.findOne(filter);
    //   res.send(result);
    // });

    //delete from cart
    app.delete("/pcbuilderCart/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await pcbuilderCartCollection.deleteOne(query);

      res.send(result);
    });

    // ===========================   Cart related Apis===================

    app.post("/cart", async (req, res) => {
      const query = req.body;
      console.log({ query });
      const result = await cartCollection.insertOne(query);
      res.send(result);
    });

    app.get("/cart", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      // const query = req.body;
      const result = await cartCollection.find(query).toArray();
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
