const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

/* Verify jwt */
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "UnAuthorization access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "UnAuthorization access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.axpgb1h.mongodb.net/?retryWrites=true&w=majority`;

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
    const hackathonCollection = client.db("warrior").collection("hackathons");
    const userCollection = client.db("warrior").collection("users");

    //jwt
    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "isAdmin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    /* Verify mentor */
    const verifyMentor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "isMentor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    //user get
    app.get(
      "/users",
      verifyJWT,
      verifyAdmin,
      verifyMentor,
      async (req, res) => {
        const result = await userCollection.find().toArray();
        res.send(result);
      }
    );

    //get admin for secure dashboard
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.params.email;
      if (email !== decodedEmail) {
        return res.send({ admin: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const admin = { admin: user?.role === "isAdmin" };
      console.log(admin);
      res.send(admin);
    });

    app.get("/users/mentor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ mentor: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const mentor = { mentor: user?.role === "isMentor" };
      console.log(mentor);
      res.send(mentor);
    });

    // user post
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "already exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // get User
    app.get("/user", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    //Delete User
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    //post Hackathons
    app.post("/hackathon", verifyJWT, async (req, res) => {
      const query = req.body;
      const result = await hackathonCollection.insertOne(query);
      res.send(result);
    });

    /* Search hackathon */
    app.get("/hackathonSearch", async (req, res) => {
      const search = req.query.search;
      const query = { title: { $regex: search, $options: "i" } };
      const result = await hackathonCollection.find(query).toArray();
      res.send(result);
    });

    // Get Hackathons
    app.get("/hackathons", async (req, res) => {
      try {
        const { title, location, category, minFirstPrize, maxFirstPrize } =
          req.query;

        let query = {};

        if (title) {
          query.title = { $regex: title, $options: "i" };
        }

        if (location) {
          query.location = { $regex: location, $options: "i" };
        }

        if (category) {
          query.category = { $regex: category, $options: "i" };
        }

        if (minFirstPrize || maxFirstPrize) {
          query.first_prize = {};

          if (minFirstPrize) {
            query.first_prize.$gte = parseFloat(minFirstPrize);
          }

          if (maxFirstPrize) {
            query.first_prize.$lte = parseFloat(maxFirstPrize);
          }
        }

        const result = await hackathonCollection.find(query).toArray();

        res.send(result);
      } catch (error) {
        console.error("Error fetching hackathons:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    // get Hackathon with Id
    app.get("/hackathon/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await hackathonCollection.findOne(query);
      res.send(result);
    });

    //Delete Hackathon
    app.delete("/hackathon/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await hackathonCollection.deleteOne(query);
      res.send(result);
    });

    //get Hackathons with specific owner
    app.get("/ownHackathon", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await hackathonCollection.find(query).toArray();
      res.send(result);
    });

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
  res.send("Hello Wolrd");
});
app.listen(port, () => {
  console.log(`server is running ${port}`);
});
