const express = require('express'); 
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;
// middleware
app.use(cors());
app.use(express.json());


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
  maxPoolSize:10,
});


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // edited
    client.connect((err)=>{
        if(err){
          console.error(err);
          return;
        }
      });
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