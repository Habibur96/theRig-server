const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();
const bodyParser = require("body-parser");

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
// Middleware to parse JSON request bodies
app.use(express.json());
app.use(bodyParser.json());

const port = process.env.PORT || 3000;
//middleware
app.use(cors());
app.use(express.json());

const uri = process.env.DB_URL;

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
    const pcbuilderCartId = client.db("theRig").collection("pcbuilderCartId");
    const savedPc = client.db("theRig").collection("savedPc");
    const paymentCollection = client.db("theRig").collection("payments");
    const wishlistCollection = client.db("theRig").collection("wishlist");
    const guidesBuildCollection = client.db("theRig").collection("guideBuild");
    const reviewCollection = client.db("theRig").collection("review");
    const questionCollection = client.db("theRig").collection("question");
    const couponCollection = client.db("theRig").collection("coupon");

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
    // Warning: use verifyJWT before using verifyDeliveryAgent
    const verifyDeliveryAgent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "deliveryAgent") {
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

    app.get("/cpu/:collectionName/:model", async (req, res) => {
      const model = req.params.model;
      const query = { model: model };
      const result = await pcbuilderCollection.find(query).toArray();
      res.send(result);
    });

    //===================SavedPc relaed api=========================
    app.post("/savedPc", async (req, res) => {
      try {
        const { email } = req?.body;
        const createPc = req?.body?.savepc;

        console.log("Request:", createPc, email);

        const newCartIdItem = { createPc, email };

        // Save the new PC configuration to the collection
        await savedPc.insertOne(newCartIdItem);

        // Log success message to console
        console.log("Data saved successfully:", newCartIdItem);

        // Remove matching data from pcbuilderCart collection where email matches
        await pcbuilderCartCollection.deleteMany({ email });

        // Remove matching data from pcbuilderCartId collection where email matches
        await pcbuilderCartId.deleteMany({ email });

        // Send a success message back to the client
        res.status(200).send("Data saved successfully");
      } catch (error) {
        // Handle the error
        console.error("Error occurred while processing request:", error);

        // Send an appropriate error response to the client
        res.status(500).send("Internal Server Error: " + error.message);
      }
    });

    //====================pcbuilderCart related api=========================

    app.post("/pcbuilderCart", async (req, res) => {
      const { cartItemId, email, category } = req.body;

      try {
        // Define the filter condition
        const filterCondition = { email, category };

        // Check if the item exists in either collection using the filter condition
        const existingCartItem = await pcbuilderCartCollection.findOne(
          filterCondition
        );
        const existingCartIdItem = await pcbuilderCartId.findOne(
          filterCondition
        );

        // If the item already exists in either collection, remove it
        if (existingCartItem) {
          await pcbuilderCartCollection.deleteOne(filterCondition);
        }

        if (existingCartIdItem) {
          await pcbuilderCartId.deleteOne(filterCondition);
        }

        // If a cartItemId is provided, remove the corresponding item
        if (cartItemId) {
          await pcbuilderCartCollection.deleteOne({ cartItemId });
          await pcbuilderCartId.deleteOne({ cartItemId });
        }

        // Insert the new item into pcbuilderCartCollection
        await pcbuilderCartCollection.insertOne(req.body);

        // Insert the new item into pcbuilderCartId
        const newCartIdItem = { cartItemId, email, category };
        await pcbuilderCartId.insertOne(newCartIdItem);

        // Fetch updated data from the database
        const result = await pcbuilderCartCollection.find({ email }).toArray();
        const pcbuilderId = await pcbuilderCartId.find({ email }).toArray();

        // Return the updated data as JSON response
        res.status(200).json({ result, pcbuilderId });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.get("/pcbuilderCart/:email", async (req, res) => {
      const email = req.params.email;

      try {
        const result = await pcbuilderCartCollection.find({ email }).toArray();
        const pcbuilderId = await pcbuilderCartId.find({ email }).toArray();
        res.status(200).json({ result, pcbuilderId });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.delete("/pcbuilderCart/:cartItemId", async (req, res) => {
      try {
        const cartItemId = req.params.cartItemId;

        // Validate input
        if (!cartItemId) {
          return res.status(400).json({ error: "Invalid cartItemId" });
        }

        // Delete item from pcbuilderCartCollection
        const { deletedCount: deletedCartItem } =
          await pcbuilderCartCollection.deleteOne({ cartItemId });
        if (deletedCartItem === 0) {
          return res
            .status(404)
            .json({ error: "Item not found in pcbuilderCartCollection" });
        }

        // Delete item from pcbuilderCartId collection
        const { deletedCount: deletedCartIdItem } =
          await pcbuilderCartId.deleteOne({ cartItemId });
        if (deletedCartIdItem === 0) {
          console.log("Item not found in pcbuilderCartId collection");
        }

        // Send success response
        res.status(200).json({ message: "Item deleted successfully" });
      } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    //========================GuidesBuild related apis==============

    app.post("/createBuild", verifyJwt, varifyAdminJwt, async (req, res) => {
      const query = req.body;
      const result = await guidesBuildCollection.insertOne(query);
      res.send(result);
      console.log(result);
    });

    app.get("/createBuild", verifyJwt, async (req, res) => {
      const result = await guidesBuildCollection.find().toArray();
      res.send(result);
      // console.log(result);
    });

    app.delete(
      "/createBuild/:id",
      verifyJwt,
      varifyAdminJwt,
      async (req, res) => {
        const id = req.params.id;
        console.log(id);
        const filter = { _id: new ObjectId(id) };
        const result = await guidesBuildCollection.deleteOne(filter);
        res.send(result);
      }
    );

    app.put("/createBuild/:id", verifyJwt, varifyAdminJwt, async (req, res) => {
      try {
        const id = req.params.id;
        console.log("Id = ", id);
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updatereadyBuild = req.body;
        const readyBuildUpdate = {
          $set: {
            cpuName: updatereadyBuild.cpuName,
            cpuImg: updatereadyBuild.cpuImg,
            cpuModel: updatereadyBuild.cpuModel,
            cpuPrice: updatereadyBuild.cpuPrice,

            cpuCoolerName: updatereadyBuild.cpuCoolerName,
            cpuCoolerImg: updatereadyBuild.cpuCoolerImg,
            cpuCoolerModel: updatereadyBuild.cpuCoolerModel,
            cpuCoolerPrice: updatereadyBuild.cpuCoolerPrice,

            mbName: updatereadyBuild.mbName,
            mbImg: updatereadyBuild.mbImg,
            mbModel: updatereadyBuild.mbModel,
            mbPrice: updatereadyBuild.mbPrice,

            memoryName: updatereadyBuild.memoryName,
            memoryImg: updatereadyBuild.memoryImg,
            memoryModel: updatereadyBuild.memoryModel,
            memoryPrice: updatereadyBuild.memoryPrice,

            monitorName: updatereadyBuild.monitorName,
            monitorImg: updatereadyBuild.monitorImg,
            monitorModel: updatereadyBuild.monitorModel,
            monitorPrice: updatereadyBuild.monitorPrice,

            storageName: updatereadyBuild.storageName,
            storageImg: updatereadyBuild.storageImg,
            storageModel: updatereadyBuild.storageModel,
            storagePrice: updatereadyBuild.storagePrice,

            gpuName: updatereadyBuild.gpuName,
            gpuImg: updatereadyBuild.gpuImg,
            gpuModel: updatereadyBuild.gpuModel,
            gpuPrice: updatereadyBuild.gpuPrice,

            caseName: updatereadyBuild.caseName,
            caseImg: updatereadyBuild.caseImg,
            caseModel: updatereadyBuild.caseModel,
            casePrice: updatereadyBuild.casePrice,

            psuName: updatereadyBuild.psuName,
            psuImg: updatereadyBuild.psuImg,
            psuModel: updatereadyBuild.psuModel,
            psuPrice: updatereadyBuild.psuPrice,

            img: updatereadyBuild.imgURL,

            buildName: updatereadyBuild.buildName,
            totalPrice: updatereadyBuild.totalPrice,
            details: updatereadyBuild.details,
          },
        };
        const result = await guidesBuildCollection.updateOne(
          filter,
          readyBuildUpdate,
          options
        );
        res.send(result);
      } catch (err) {
        res.send(500).send("Error Occured");
      }
    });

    // app.put("/createBuild/:id", verifyJwt, varifyAdminJwt, async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     console.log("Id = ", id);
    //     const filter = { _id: new ObjectId(id) };
    //     console.log("filter = ", filter);
    //     const updatereadyBuild = req.body;
    //     console.log("updatereadyBuild = ", updatereadyBuild);

    //     const readyBuildUpdate = { $set: {} }; // Initialize with $set operator
    //     for (const key in updatereadyBuild) {
    //       if (updatereadyBuild[key] !== undefined) {

    //         readyBuildUpdate.$set[key] = updatereadyBuild[key];
    //       }
    //     }

    //     // Log the constructed update object for debugging
    //     console.log("readyBuildUpdate = ", readyBuildUpdate);

    //     const result = await guidesBuildCollection.updateOne(
    //       filter,
    //       readyBuildUpdate
    //     );
    //     console.log("Result = ", result);
    //     res.send(result);
    //   } catch (err) {
    //     console.error(err); // Log the error for debugging
    //     res.status(500).send("Error Occurred");
    //   }
    // });
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
    app.get("/users/deliveryAgent/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ deliveryAgent: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { deliveryAgent: user?.role === "deliveryAgent" };
      res.send(result);
    });

    app.put("/users/role/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const { role: contributor } = req.body;
      const updateRole = {
        $set: {
          role: contributor,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateRole,
        options
      );
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

    // ===================== Review related apis=======================

    app.post("/review", verifyJwt, async (req, res) => {
      const query = req.body;
      const result = await reviewCollection.insertOne(query);
      res.send(result);
    });

    app.get("/review", verifyJwt, async (req, res) => {
      const query = req.body;
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });

    // ===================== User Question Related Apis====================

    app.post("/question", verifyJwt, async (req, res) => {
      const query = req.body;
      const result = await questionCollection.insertOne(query);
      res.send(result);
    });

    app.get("/question", verifyJwt, async (req, res) => {
      const query = req.body;
      const result = await questionCollection.find(query).toArray();
      res.send(result);
    });

    // ===========================   Cart related Apis===================

    app.post("/cart", verifyJwt, async (req, res) => {
      const query = req.body;
      console.log({ query });
      const result = await cartCollection.insertOne(query);
      console.log(result);
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

    app.put("/cart/:id", verifyJwt, async (req, res) => {
      try {
        const id = req.params.id;
        console.log("Id = ", id);
        const filter = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateQuantity = req.body.quantity;
        console.log("UpdateQuantity = ", updateQuantity);
        const productQuantity = {
          $set: {
            quantity: updateQuantity,
          },
        };
        const result = await cartCollection.updateOne(
          filter,
          productQuantity,
          options
        );
        console.log("Result = ", result);
        res.send(result);
      } catch (err) {
        res.send(500).send("Error Occured");
      }
    });

    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      // console.log({ id });
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteMany(query);
      res.send(result);
    });

    // ===============WishList related apis===================
    app.post("/wishlist", verifyJwt, async (req, res) => {
      const query = req.body;
      const result = await wishlistCollection.insertOne(query);
      res.send(result);
    });

    app.get("/wishlist", verifyJwt, async (req, res) => {
      const query = req.body;
      const result = await wishlistCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/wishlist/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await wishlistCollection.deleteOne(query);
      console.log("result = ", result);
      res.send(result);
    });

    app.delete("/payments/:id", verifyJwt, varifyAdminJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await paymentCollection.deleteOne(query);
      console.log("result = ", result);
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

    app.post("/payments", verifyJwt, async (req, res) => {
      const payment = req.body;
      console.log({ payment });

      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.cartIds.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await cartCollection.deleteMany(query);

      // Aggregate the update operations
      const bulkOperations = payment.menuItemIds.map((menuItemId, index) => ({
        updateOne: {
          filter: { _id: new ObjectId(menuItemId) },
          update: { $inc: { buildQty: -payment.menuItemQuantity[index] } },
        },
      }));

      // Execute the bulk operations
      const bulkWriteResult = await guidesBuildCollection.bulkWrite(
        bulkOperations
      );

      // send user email about payment confirmation
      mg.messages
        .create(process.env.MAIL_SENDING_DOMAIN, {
          from: "Mailgun Sandbox <postmaster@sandboxeb26e7e0bd8343bb8651501e90b6f5c4.mailgun.org>",
          to: ["habiburrahmannayan66@gmail.com"],
          subject: "TheRig Order Confirmation",
          text: "Testing some Mailgun awesomeness!",
          html: `
              <div>
                  <h2>Thank you for your order</h2>
                  <h4>Your Transaction Id: <strong>${payment.transactionId}</strong></h4>
                  <p>We would like to get your feedback about theRig</p>
              </div>
              `,
        })
        .then((msg) => console.log(msg)) // logs response data
        .catch((err) => console.log(err)); // logs any error

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

    // ===================Admin Home================

    app.get("/admin-stats", verifyJwt, varifyAdminJwt, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const products = await pcbuilderCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce((sum, payment) => sum + payment.price, 0);
      res.send({
        users,
        products,
        orders,
        revenue,
      });
    });

    app.get("/order-stats", verifyJwt, varifyAdminJwt, async (req, res) => {
      const pipeline = [
        {
          $lookup: {
            from: "menu",
            localField: "menuItems",
            foreignField: "_id",
            as: "menuItemsData",
          },
        },
        {
          $unwind: "$menuItemsData",
        },
        {
          $group: {
            _id: "$menuItemsData.category",
            count: { $sum: 1 },
            total: { $sum: "$menuItemsData.price" },
          },
        },
        {
          $project: {
            category: "$_id",
            count: 1,
            total: { $round: ["$total", 2] },
            _id: 0,
          },
        },
      ];

      const result = await paymentCollection.aggregate(pipeline).toArray();
      res.send(result);
      
    });

    app.get("/payments", verifyJwt, async (req, res) => {
      const query = req.body;
      const result = await paymentCollection.find(query).toArray();

      res.send(result);
    });

    app.put("/payments/:id", verifyJwt, async (req, res) => {
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

    // =======================Coupon related Apis=================

    app.post("/coupon", verifyJwt, varifyAdminJwt, async (req, res) => {
      const query = req.body;
      const result = await couponCollection.insertOne(query);
      res.send(result);
    });

    app.get("/coupon", verifyJwt, varifyAdminJwt, async (req, res) => {
      const query = req.body;
      const result = await couponCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/coupon/:id", verifyJwt, varifyAdminJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await couponCollection.deleteOne(query);

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
