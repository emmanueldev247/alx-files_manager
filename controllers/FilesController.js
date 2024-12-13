const path = require('path');
const fs = require('fs').promises;
const { ObjectId } = require('mongodb');
const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class FilesController {
  static async postUpload(req, res) {
    try {
      const xToken = req.headers['x-token'];
      const key = `auth_${xToken}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (!dbClient.DB) await dbClient.init();
      const usersCollection = await dbClient.DB.collection('users');
      const user = await usersCollection.findOne({ _id: ObjectId(userId) });
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const {
        name, type, parentId = '0', isPublic = false, data,
      } = req.body;
      if (!name) return res.status(400).json({ error: 'Missing name' });
      if (!['folder', 'file', 'image'].includes(type)) {
        return res.status(400).json({ error: 'Missing type' });
      }
      if (type !== 'folder' && !data) {
        return res.status(400).json({ error: 'Missing data' });
      }

      const filesCollection = dbClient.DB.collection('files');

      if (parentId !== '0') {
        const parentFile = await filesCollection.findOne({ _id: ObjectId(parentId) });
        if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
        if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
      }

      const fileDocument = {
        userId: ObjectId(userId),
        name,
        type,
        isPublic,
        parentId: parentId === '0' ? '0' : ObjectId(parentId),
      };

      if (type === 'folder') {
        const result = await filesCollection.insertOne(fileDocument);
        fileDocument.id = result.insertedId;
      } else {
        const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
        await fs.mkdir(FOLDER_PATH, { recursive: true });
        const localPath = path.join(FOLDER_PATH, uuidv4());
        fs.writeFile(localPath, Buffer.from(data, 'base64'));

        fileDocument.localPath = localPath;
        const result = await filesCollection.insertOne(fileDocument);
        fileDocument.id = result.insertedId;
      }

      const response = {
        id: fileDocument.id,
        userId: fileDocument.userId,
        name: fileDocument.name,
        type: fileDocument.type,
        isPublic: fileDocument.isPublic,
        parentId: fileDocument.parentId,
      };

      return res.status(201).json(response);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getShow(req, res) {
    try {
      const xToken = req.headers['x-token'];
      const key = `auth_${xToken}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.params;

      if (!dbClient.DB) await dbClient.init();
      const usersCollection = await dbClient.DB.collection('users');
      const user = await usersCollection.findOne({ _id: ObjectId(userId) });
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const filesCollection = await dbClient.DB.collection('files');
      const fileDocument = await filesCollection.findOne({ _id: ObjectId(id) });
      const fileDocument2 = await filesCollection.findOne({ userId: ObjectId(userId) });
      if (!fileDocument && !fileDocument2) return res.status(404).json({ error: 'Not found' });

      const response = {
        id: fileDocument.id,
        userId: fileDocument.userId,
        name: fileDocument.name,
        type: fileDocument.type,
        isPublic: fileDocument.isPublic,
        parentId: fileDocument.parentId,
      };

      return res.status(201).json(response);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getIndex(req, res) {
    try {
      return res.status(200).json({ success: 'true' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = FilesController;
