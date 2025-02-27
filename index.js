const express = require("express");
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const cookieParser = require("cookie-parser");

//

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://demo1-c8fa2.web.app",
    "https://demo1-c8fa2.firebaseapp.com",
  ],
  credentials: true,
  optionalSuccesssStatus: 200,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Environment variables
const PORT = process.env.PORT || 3000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jhe6fdr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// verifyToken
function verifyToken(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "unauthorized access" });
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }

    req.user = decoded;
    next();
  });
}

async function run() {
  try {
    const db = client.db("matrimonyDB");
    const userCollection = db.collection("user");
    const biodataCollection = db.collection("biodata");
    const paymentCollection = db.collection("payment");
    const mycontactCollection = db.collection("mycontact");
    const myfavouriteCollection = db.collection("myfavourite");
    const premiumCollection = db.collection("premium");
    const successstoryCollection = db.collection("success");
    const homepremiumbiodataCollection = db.collection("homepremium");
    const bioIdCounterCollection = db.collection("bioidcounter");
    // Routes

    // jwt
    // jwt generation and cookie deletion
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      // create token
      const token = jwt.sign(email, process.env.SECRET_KEY, {
        expiresIn: "5d",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // cookie deletion
    app.get("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // user related api

    const verifyAdmin = async (req, res, next) => {
      const email = req.user?.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.get("/singleUser", verifyToken, async (req, res) => {
      const email = req.query.email;

      const query = { email: email };
      const decodedEmail = req.user?.email;
      if (decodedEmail !== email) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }

      const result = await userCollection.findOne(query);

      res.send(result);
    });

    // all users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      // const email = req.query.email;
      const search = req.query.name;
      console.log(search);
      let query = {};

      // const decodedEmail = req.user?.email;
      // if (decodedEmail !== email) {
      //   return res.status(401).send({ message: "Unauthorized Access" });
      // }
      if (search) {
        query.name = {
          $regex: search,
          $options: "i",
        };
      }

      const result = await userCollection.find(query, search).toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.user?.email;
      if (decodedEmail !== email) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);

      let admin = false;
      if (user) {
        admin = user.role === "admin";
      }
      res.send(admin);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existedUser = await userCollection.findOne(query);
      if (existedUser) {
        return res.send({ message: "user exist already", insertedId: null });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    //  test
    app.get("/", async (req, res) => {
      res.send("How u doin");
    });

    // Biodata
    app.get("/biodatacount", async (req, res) => {
      const count = await biodataCollection.countDocuments();
      res.send({ count: count });
    });

    app.get("/biodata", async (req, res) => {
      const filters = req.query;
      const page = parseInt(filters.page) - 1;
      const size = parseInt(filters.items);

      let query = {};

      if (filters.BiodataType) {
        query.type = filters.BiodataType;
      }

      if (filters.division) {
        query.permanent_division = filters.division;
      }

      // Filter by Age range (e.g., minAge and maxAge)
      if (filters.minAge || filters.maxAge) {
        query.age = {};
        if (filters.minAge) {
          query.age.$gte = parseInt(filters.minAge); // Greater than or equal to minAge
        }
        if (filters.maxAge) {
          query.age.$lte = parseInt(filters.maxAge); // Less than or equal to maxAge
        }
      }

      try {
        const result = await biodataCollection
          .find(query)
          .skip(page * size)
          .limit(size)
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch biodata" });
      }
    });

    // biodata details
    app.get("/biodetails/:id", async (req, res) => {
      const { id } = req.params;

      let query = { _id: new ObjectId(id) };

      const result = await biodataCollection.findOne(query);

      res.send(result);
    });

    // for similar biodata

    app.get("/biodetails", async (req, res) => {
      const type = req.query.type;
      const id = req.query.id;

      const query = { type: type, _id: { $ne: new ObjectId(id) } };
      const result = await biodataCollection
        .aggregate([
          { $match: query },
          { $sample: { size: 3 } }, // Randomly select 3 documents
        ])
        .toArray();

      res.send(result);
    });

    app.get("/biodata/:email", async (req, res) => {
      const { email } = req.params;

      const query = { email: email };
      const result = await biodataCollection.findOne(query);
      const isExist = result ? true : false;
      res.send(isExist);
    });

    app.get("/biodataDetails/:email", async (req, res) => {
      const { email } = req.params;

      const query = { email: email };
      const result = await biodataCollection.findOne(query);

      res.send(result);
    });

    app.post("/biodata", async (req, res) => {
      const data = req.body;
      const filter = { _id: new ObjectId("678de12b6379a98e29e0b83d") };

      const obj = await bioIdCounterCollection.findOne(filter);

      let prevId = obj.lastId;

      data.BioId = ++prevId;
      console.log(prevId);
      const updateDoc = {
        $inc: { lastId: 1 },
      };
      const update = await bioIdCounterCollection.updateOne(filter, updateDoc);
      const result = await biodataCollection.insertOne(data);
      console.log(result);
      res.send(result);
    });

    app.patch("/biodata", verifyToken, async (req, res) => {
      const data = req.body;
      const decodedEmail = req.user?.email;

      if (decodedEmail !== data.email) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }
      const filter = { email: data.email };
      const updateDoc = {
        $set: {
          type: data.type,
          image: data.image,
          name: data.name,
          age: data.age,
          dob: data.dob,

          mobile: data.mobile,
          expected_partner_age: data.expected_partner_age,
          expected_partner_height: data.expected_partner_height,
          expected_partner_weight: data.expected_partner_weight,
          father_name: data.father_name,
          mother_name: data.mother_name,
          height: data.height,
          weight: data.weight,
          occupation: data.occupation,
          permanent_division: data.permanent_division,
          present_division: data.present_division,
          race: data.race,
        },
      };

      const result = await biodataCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // biodata admin dashboard

    app.get("/biodata_count", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.query.email;

      const decodedEmail = req.user?.email;

      if (decodedEmail !== email) {
        console.log(decodedEmail !== data.email);
        return res.status(401).send({ message: "Unauthorized Access" });
      }

      try {
        const result = await biodataCollection
          .aggregate([
            {
              $facet: {
                totalCount: [{ $count: "count" }], // Total biodata count
                maleCount: [
                  { $match: { type: "Male" } }, // Filter for male biodata
                  { $count: "count" },
                ],
                femaleCount: [
                  { $match: { type: "Female" } }, // Filter for female biodata
                  { $count: "count" },
                ],
              },
            },
            {
              $project: {
                totalCount: { $arrayElemAt: ["$totalCount.count", 0] },
                maleCount: { $arrayElemAt: ["$maleCount.count", 0] },
                femaleCount: { $arrayElemAt: ["$femaleCount.count", 0] },
              },
            },
          ])
          .toArray();

        const stats = result[0] || { totalCount: 0, maleCount: 0 };

        const revenueStats = await paymentCollection
          .aggregate([
            {
              $group: {
                _id: null, //all dcouments
                totalRevenue: { $sum: "$price" },
              },
            },
          ])
          .toArray();

        const totalRevenue = revenueStats[0]?.totalRevenue || 0;

        const premiumStats = await premiumCollection
          .aggregate([
            {
              $group: {
                _id: null, //all dcouments
                totalPremium: { $sum: 1 },
              },
            },
          ])
          .toArray();

        const totalPremiumCount = premiumStats[0]?.totalPremium || 0;

        res.send({
          message: "Success",
          totalBiodataCount: stats.totalCount || 0,
          maleBiodataCount: stats.maleCount || 0,
          femaleBiodataCount: stats.femaleCount || 0,
          totalRevenue,
          totalPremiumCount,
        });
      } catch (error) {
        console.error("Error fetching biodata stats:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // admin route - make premium

    app.get("/premium", async (req, res) => {
      const result = await premiumCollection.find().toArray();
      const query = { email: result.email };

      res.send(result);
    });

    app.get("/premium/:email", async (req, res) => {
      const email = req.params.email;

      const query = { email: email };
      const result = await premiumCollection.findOne(query);

      res.send(result);
    });

    app.post("/premium", async (req, res) => {
      const body = req.body;
      const result = await premiumCollection.insertOne(body);
      res.send(result);
    });

    app.patch("/premium/:email", async (req, res) => {
      const email = req.params.email;
      const value = req.body.changevalue;
      // name: user?.displayName,
      // bio_id: data?.BioId,
      const filter = { email: email };
      const updateDoc = {
        $set: {
          premium: value,
        },
      };
      const updateDoc2 = {
        $set: {
          isPremium: value,
        },
      };

      const search = { email: email };

      const isExist = await homepremiumbiodataCollection.findOne(search);

      if (!isExist) {
        const findBio = await biodataCollection.findOne(search);

        const creatBio = await homepremiumbiodataCollection.insertOne(findBio);
      }

      const options = { upsert: true };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const result2 = await premiumCollection.updateOne(
        filter,
        updateDoc2,
        options
      );

      res.send({ result, result2 });
    });

    // mycontact api

    app.get("/mycontactrequest", async (req, res) => {
      const result = await mycontactCollection.find().toArray();

      res.send(result);
    });

    app.get("/mycontactrequest/:email", async (req, res) => {
      const email = req.params.email;

      const query = {
        email: email,
      };
      const result = await mycontactCollection.findOne(query);

      res.send(result);
    });

    app.get("/mycontactrequestUser/:email", async (req, res) => {
      const email = req.params.email;

      const query = {
        email: email,
      };
      const result = await mycontactCollection.find(query).toArray();

      res.send(result);
    });

    app.post("/mycontactrequest", async (req, res) => {
      const data = req.body;
      const result = await mycontactCollection.insertOne(data);
      res.send(result);
    });

    //admin

    // for admin patch
    app.patch("/mycontactrequest/:email", async (req, res) => {
      const email = req.params.email;
      const body = req.body.changevalue;

      const filter = { email: email };
      const updateDoc = {
        $set: {
          status: body,
        },
      };

      const result = await mycontactCollection.updateOne(filter, updateDoc);

      res.send(result);
    });

    app.delete("/mycontactrequest/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await mycontactCollection.deleteOne(query);
      res.send(result);
    });

    // myfavourite api

    app.get("/myfavourite/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await myfavouriteCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/myfavourite", async (req, res) => {
      const body = req.body;
      const result = await myfavouriteCollection.insertOne(body);
      res.send(result);
    });

    app.delete("/myfavourite/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await myfavouriteCollection.deleteOne(query);
      res.send(result);
    });

    // user success story

    // forhome
    app.get("/successstory", async (req, res) => {
      const query = {};
      const options = {
        // Sort returned documents in ascending order by title (A->Z)
        sort: {
          marriageDate: 1,
        },
      };
      const result = await successstoryCollection
        .find(query, options)
        .toArray();
      res.send(result);
    });

    app.get("/success_story", async (req, res) => {
      const result = await successstoryCollection.find().toArray();

      res.send(result);
    });

    app.post("/success_story", async (req, res) => {
      const body = req.body;
      const result = await successstoryCollection.insertOne(body);
      res.send(result);
    });

    // Home page api

    app.get("/counter_home", async (req, res) => {
      try {
        const result = await biodataCollection
          .aggregate([
            {
              $facet: {
                totalCount: [{ $count: "count" }], // Total biodata count
                maleCount: [
                  { $match: { type: "Male" } }, // Filter for male biodata
                  { $count: "count" },
                ],
                femaleCount: [
                  { $match: { type: "Female" } }, // Filter for female biodata
                  { $count: "count" },
                ],
              },
            },
            {
              $project: {
                totalCount: { $arrayElemAt: ["$totalCount.count", 0] },
                maleCount: { $arrayElemAt: ["$maleCount.count", 0] },
                femaleCount: { $arrayElemAt: ["$femaleCount.count", 0] },
              },
            },
          ])
          .toArray();

        const stats = result[0] || { totalCount: 0, maleCount: 0 };

        const successStats = await successstoryCollection
          .aggregate([
            {
              $group: {
                _id: null, //all dcouments
                totalSuccess: { $sum: 1 },
              },
            },
          ])
          .toArray();

        const totalSuccessCount = successStats[0]?.totalSuccess || 0;

        res.send({
          message: "Success",
          totalBiodataCount: stats.totalCount || 0,
          maleBiodataCount: stats.maleCount || 0,
          femaleBiodataCount: stats.femaleCount || 0,

          totalSuccessCount,
        });
      } catch (error) {
        console.error("Error fetching biodata stats:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get("/premimumlimited", async (req, res) => {
      const order = req.query.sort;

      const query = {};

      const options = {
        // Sort returned documents in ascending order by title (A->Z)
        sort: order === "ascending" ? { age: 1 } : { age: -1 },
      };

      const result = await homepremiumbiodataCollection
        .find(query, options)
        .limit(6)
        .toArray();
      res.send(result);
    });

    // payment intent

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/bioidcounter", async (req, res) => {
      const body = { lastId: 22 };
      const result = await bioIdCounterCollection.insertOne(body);
      res.send(result);
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      res.send(paymentResult);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
