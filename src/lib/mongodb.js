import { MongoClient, ServerApiVersion } from "mongodb";

if (!process.env.MONGODB_URI || process.env.MONGODB_URI.trim() === "") {
  throw new Error('FATAL ERROR: Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // Optimize connection pool for serverless/Next.js environment
  maxPoolSize: 10,
  minPoolSize: 1,
  connectTimeoutMS: 10000, // 10 seconds to timeout
};

let client;
let clientPromise;

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect()
      .then((c) => {
        console.log("✅ [MongoDB] Connected successfully in development mode.");
        return c;
      })
      .catch((err) => {
        console.error("❌ [MongoDB] Connection failed in development mode:", err);
        throw err;
      });
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect()
    .then((c) => {
      console.log("✅ [MongoDB] Connected successfully in production mode.");
      return c;
    })
    .catch((err) => {
      console.error("❌ [MongoDB] Connection failed in production mode:", err);
      throw err;
    });
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;
