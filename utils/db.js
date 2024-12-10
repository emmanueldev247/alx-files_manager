import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const HOST = process.env.DB_HOST || 'localhost';
    const PORT = process.env.DB_PORT || '27017';
    const DB_NAME = process.env.DB_DATABASE || 'files_manager';

    this.client = new MongoClient(`mongodb://${HOST}:${PORT}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    this.isClientConnected = false;
    this.init(DB_NAME);
  }

  async init(DB_NAME) {
    try {
      await this.client.connect();
      this.DB = this.client.db(DB_NAME);
      this.isClientConnected = true;
    } catch (err) {
      console.log(err);
      this.isClientConnected = false;
    }
  }

  isAlive = () => this.isClientConnected;

  async nbUsers() {
    const usersCol = this.DB.collection('users');
    return await usersCol.countDocuments();
  };

  async nbFiles() {
    const filesCol = this.DB.collection('files');
    return await filesCol.countDocuments();
  };
}

const dbClient = new DBClient;

module.exports = dbClient;
