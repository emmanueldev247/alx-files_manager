import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const HOST = process.env.DB_HOST || 'localhost';
    const PORT = process.env.DB_PORT || '27017';
    const URI = `mongodb://${HOST}:${PORT}`;

    this.client = new MongoClient(URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
    });

    this.init();
  }

  async init() {
    try {
      const DB_NAME = process.env.DB_DATABASE || 'files_manager';
      await this.client.connect();
      this.DB = this.client.db(DB_NAME);
    } catch (err) {
      console.log(err);
    }
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    const usersCol = this.DB.collection('users');
    return usersCol.countDocuments();
  }

  async nbFiles() {
    const filesCol = this.DB.collection('files');
    return filesCol.countDocuments();
  }
}

const dbClient = new DBClient();

module.exports = dbClient;
