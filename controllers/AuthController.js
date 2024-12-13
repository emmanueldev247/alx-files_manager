const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class AuthController {
  static async getConnect(req, res) {
    try {
      const { authorization } = req.headers;
      if (!authorization) return res.status(401).json({ error: 'Unauthorized' });

      const base64String = authorization.split(' ')[1];
      if (!base64String) return res.status(401).json({ error: 'Unauthorized' });

      const decodedAuth = Buffer.from(base64String, 'base64').toString('utf-8');
      if (!decodedAuth) return res.status(401).json({ error: 'Unauthorized' });

      const [email, password] = decodedAuth.split(':');
      if (!email || !password) return res.status(401).json({ error: 'Unauthorized' });

      const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

      if (!dbClient.DB) await dbClient.init();
      const usersCollection = dbClient.DB.collection('users');
      const user = await usersCollection.findOne({ email, password: hashedPassword });
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const token = uuidv4();
      const key = `auth_${token}`;

      await redisClient.set(key, user._id.toString(), 24 * 3600);
      return res.status(200).json({ token });
    } catch (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getDisconnect(req, res) {
    try {
      const xToken = req.headers['x-token'];

      const key = `auth_${xToken}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (!dbClient.DB) await dbClient.init();
      const usersCollection = dbClient.DB.collection('users');
      const user = await usersCollection.findOne({ _id: ObjectId(userId) });

      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      await redisClient.del(key);
      return res.status(204).end();
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = AuthController;
