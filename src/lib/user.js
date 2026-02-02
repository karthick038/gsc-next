import clientPromise from "./mongodb";

export async function getUserByEmail(email) {
    try {
        const client = await clientPromise;
        const db = client.db();
        const user = await db.collection("users").findOne({ email });
        return user;
    } catch (error) {
        console.error("Failed to fetch user:", error);
        throw new Error("Failed to fetch user.");
    }
}
