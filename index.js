const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const app = express();
const port = process.env.PORT || 5000;
// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.urfvppf.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  //edited
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // edited
    client.connect((err) => {
      if (err) {
        console.error(err);
        return;
      }
    });

    const usersCollection = client.db("languageDb").collection("users");
    const classCollection = client.db("languageDb").collection("class");
    const cartCollection = client.db("languageDb").collection("carts");
    const paymentCollection = client.db("languageDb").collection("payments");

    // JWT
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })
    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }
    // User related apis
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.post('/users', async (req, res) => {
      const user = req.body;
      // console.log(user);
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      // console.log("existingUser",existingUser);
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    // Admin

    //  security layer: verifyJWT
    // email same
    // check admin
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    // Instructor
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);

    })

    // class
    app.get('/class', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })
    app.post('/class', verifyJWT, verifyInstructor, async (req, res) => {
      const newItem = req.body;
      const result = await classCollection.insertOne(newItem)
      res.send(result);
    })
    app.delete('/class/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.deleteOne(query);
      res.send(result);
    })
    // class -- patch
    app.patch('/classes/admin/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: 'approved'
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc, options);
      res.send(result);

    })
    app.patch('/classes/admin/deny/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: 'deny'
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc, options);
      res.send(result);

    })
    app.post('/classes/admin/feedback/:id', async (req, res) => {
      const id = req.params.id;
      console.log(req.body.feedback);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          feedback: req.body.feedback
        },
      };

      const result = await classCollection.updateOne(filter, updateDoc, options);
      res.send(result);

    })

    // cart collection apis
    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden cart access' })
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });


    // selected class---> cart
    app.post('/carts', async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    })
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })
    // My classes

    app.get("/myClass/:email", async (req, res) => {
      console.log(req.params.id);
      const classes = await classCollection
        .find({
          email: req.params.email,
        })
        .toArray();
      res.send(classes);
    });
    app.get('/payments', async (req, res) => {
      const result = await paymentCollection.find().sort({ date: -1 }).toArray();
      res.send(result);
    });
    // instructor update 
    // app.put("/myClass/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const body = req.body;

    //   const filter = { _id: new ObjectId(id) };
    //   const updateDoc = {
    //     $set: {
    //       className: body.price,
    //     },
    //   };
    //   const result = await classCollection.updateOne(filter, updateDoc);
    //   res.send(result);
    // });
    // app.get("/myClass/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const filter = { _id: new ObjectId(id) }
    //   const result = await classCollection.findOne(filter)
    //   res.send(result)
    // });
    // approved classes
    app.get("/AllClasses", async (req, res) => {
      const result = await classCollection
        .find({ status: "approved" })
        .sort({ enrolled: -1 })
        .toArray();
      res.send(result);
    });
    app.get("/AllClasses", async (req, res) => {
      const result = await classCollection
        .find({ role: "approved" })
        .sort({ enrolled: -1 })
        .toArray();
      res.send(result);
    });
    // instructor
    app.get("/instructor", async (req, res) => {
      console.log(req.params.id);
      const classes = await cartCollection
        .find({
          role: req.params.instructor,
        })
        .toArray();
      res.send(classes);
    });
    // popular 

    app.get("/popularInstructor", async (req, res) => {
      console.log(req.params.id);
      const classes = await cartCollection
        .find({
          role: req.params.instructor,
        })
        .limit(6)
        .toArray();
      res.send(classes);
    });

    // popular classes
    app.get("/popularClasses", async (req, res) => {
      const result = await classCollection
        .find({ status: "approved" })
        .sort({ enrolled: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // create payment intent
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(price, amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    //payment related api
    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const filter = { _id: new ObjectId(payment?.ClassId) }
      const classItems = await classCollection.findOne(filter);
      const enrolled = classItems.enrolled + 1;
      const availableSeat = classItems.availableSeat - 1;
      const updateClassItems = {
        $set: { enrolled, availableSeat },
      }
      const insertResult = await paymentCollection.insertOne(payment);

      const query = { _id: new ObjectId(payment._id) };
      const deleteResult = await cartCollection.deleteOne(query)

      const updateResult = await classCollection.updateOne(filter, updateClassItems)
      res.send({ insertResult, deleteResult, updateResult });
    })
    app.get('/payments', async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });
    //   app.post('/payments', verifyJWT, async (req, res) => {
    //     const paymentInfo = req.body;
    //     const insertResult = await paymentCollection.insertOne(paymentInfo);

    //     const query = { _id: new ObjectId(paymentInfo._id) };
    //     const deleteResult = await bookedClasses.deleteOne(query);

    //     res.send({ insertResult, deleteResult });
    // });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // commented ,edited
    // await client.close();
  }
}
run().catch(console.dir);

// create a GET route
app.get('/', (req, res) => {
  res.send({ express: 'YOUR Language Camps IS CONNECTED TO REACT' });
});
// This displays message that the server running and listening to specified port
app.listen(port, () => console.log(`Listening on port ${port}`));
// vercel --prod