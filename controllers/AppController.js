const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class AppController {
  static getStatus(req, res) {
    const status = {
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    };
    res.status(200).json(status);
  }

  static async getStats(req, res) {
    const stat = {
      users: await dbClient.nbUsers(),
      files: await dbClient.nbFiles(),
    };
    res.status(200).json(stat);
  }
}

module.exports = AppController;
