import clientPromise from "@/lib/mongodb";

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db();

  if (req.method === "GET") {
    const users = await db.collection("users").find({}).toArray();
    res.status(200).json(users);
  }

  if (req.method === "POST") {
    const user = req.body;
    const result = await db.collection("users").insertOne(user);
    res.status(201).json(result);
  }
}
