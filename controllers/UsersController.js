const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!password) return res.status(400).json({ error: 'Missing password' });

    try {
      const usersCollection = dbClient.DB.collection('users');
      const user = await usersCollection.findOne({ email });

      if (user) return res.status(400).json({ error: 'Already exist' });

      const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
      const newUser = await usersCollection.insertOne({ email, password: hashedPassword });

      return res.status(201).json({ id: newUser.insertedId, email });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getMe(req, res) {
    try {
      const xToken = req.headers['x-token'];

      const key = `auth_${xToken}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const usersCollection = dbClient.DB.collection('users');
      const user = await usersCollection.findOne({ _id: ObjectId(userId) });

      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      return res.json({ id: user._id, email: user.email });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = UsersController;
