const crypto = require('crypto');
const dbClient = require('../utils/db');

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
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = UsersController;
