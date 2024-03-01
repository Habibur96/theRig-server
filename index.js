const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: process.env.MAIL_GUN_API_KEY,
});

const port = process.env.PORT || 3000;
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
    const usersCollection = client.db("theRig").collection("users");
    const pcbuilderCartCollection = client
      .db("theRig")
      .collection("pcbuilderCart");
    const paymentCollection = client.db("theRig").collection("payments");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      console.log({ user });
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      console.log(token);
      res.send({ token });
    });

    
    // Warning: use verifyJWT before using verifyAdmin
    const varifyAdminJwt = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    app.post("/cpu", verifyJwt, varifyAdminJwt, async (req, res) => {
      const query = req.body;
      const result = await pcbuilderCollection.insertOne(query);
      res.send(result);
      console.log(result);
    });

    app.get("/cpu/search", verifyJwt, varifyAdminJwt, async (req, res) => {
      const sort = req.query.sort;
      const search = req.query.search;
      const query = { name: { $regex: search, $options: "i" } };
      const options = {
        // sort matched documents in descending order by rating
        sort: {
          price: sort === "asc" ? 1 : -1,
        },
      };
      const cursor = pcbuilderCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/cpu", async (req, res) => {
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
      // console.log({ query });
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

    // ======================User related apis===================
    app.get("/users", verifyJwt, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.patch("/users/:id", verifyJwt, async (req, res) => {
      try { 
        const id = req.params.id;
        console.log("Id = ", id);
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updatestarpoints = req.body.points;
        console.log("UpdatestarPoints = ", updatestarpoints);
        const userstarpoints = {
          $set: {
            starpoints: updatestarpoints,
          },
        };
        console.log("UserstarPoints = ", userstarpoints);
        const result = await usersCollection.updateOne(
          filter,
          userstarpoints,
          options
        );
        console.log("Result = ", result);
        res.send(result);
      } catch (err) {
        res.status(400).send("Error Occured");
      }
    });


    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exits" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
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
      // console.log({ query });
      const result = await cartCollection.insertOne(query);
      res.send(result);
    });

    app.get("/cart", verifyJwt, async (req, res) => {
      const decoded = req.decoded;
      if (decoded.email !== req.query.email) {
        return res.status(403).send({ error: 1, message: "forbidden access" });
      }

      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }

      // const query = req.body;
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      // console.log({ id });
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteMany(query);
      res.send(result);
    });

    //create payment intent
    app.post("/create-payment-intent", verifyJwt, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log("amount = ", amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      // console.log({paymentIntent})
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //payment related api

    app.post("/payments", verifyJwt, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);
      //delete each item from the cart
      const query = {
        _id: { $in: payment.cartIds.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await cartCollection.deleteMany(query);

      //send user email about payment confirmation
      mg.messages
        .create(process.env.MAIL_SENDING_DOMAIN, {
          from: "Mailgun Sandbox <postmaster@sandboxeb26e7e0bd8343bb8651501e90b6f5c4.mailgun.org>",
          to: ["habiburrahmannayan66@gmail.com"],
          subject: "TheRig Order Confirmation",
          text: "Testing some Mailgun awesomness!",
          html: `
          <div>
          <h2>Thank you for your order</h2>
          <h4>Your Transaction Id: <strong>${payment.transactionId}</strong></h4>
          <p>We would like to get your feedback about theRig</p>
          </div>
          `,
        })
        .then((msg) => console.log(msg)) // logs response data
        .catch((err) => console.log(err)); // logs any error`;

      res.send({ insertResult, deleteResult });
    });

    app.get("/payments/:email", verifyJwt, async (req, res) => {
      const query = { email: req.params.email };

      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    //=========================DashBoard admin related apis========================

    app.get("/payments", verifyJwt, varifyAdminJwt, async (req, res) => {
      const query = req.body;
      const result = await paymentCollection.find(query).toArray();

      res.send(result);
    });

    app.put("/payments/:id", verifyJwt, varifyAdminJwt, async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateOrderStatus = req.body.orderStatus;
        const orderStatusUpdate = {
          $set: {
            orderStatus: updateOrderStatus,
          },
        };
        const result = await paymentCollection.updateOne(
          filter,
          orderStatusUpdate,
          options
        );
        res.send(result);
      } catch (err) {
        res.send(500).send("Error Occured");
      }
    });

    app.delete("/payments/:id", verifyJwt, varifyAdminJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await paymentCollection.deleteOne(query);
      console.log("result = ", result);
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
