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
      const fileDocument = await filesCollection.findOne(
        { _id: ObjectId(id), userId: ObjectId(userId) },
      );

      if (!fileDocument) return res.status(404).json({ error: 'Not found' });

      const response = {
        id: fileDocument._id,
        userId: fileDocument.userId,
        name: fileDocument.name,
        type: fileDocument.type,
        isPublic: fileDocument.isPublic,
        parentId: fileDocument.parentId,
      };

      return res.status(200).json(response);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getIndex(req, res) {
    try {
      const xToken = req.headers['x-token'];
      const key = `auth_${xToken}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { parentId = '0', page = '0' } = req.query;
      const parentIdValue = parentId === '0' ? parentId : ObjectId(parentId);
      const limit = 20;

      const skip = parseInt(page, 10) * limit;

      if (!dbClient.DB) await dbClient.init();
      const filesCollection = await dbClient.DB.collection('files');

      const matchQuery = { userId: ObjectId(userId) };
      if (parentId !== '0') {
        matchQuery.parentId = parentIdValue;
      }
      const fileDocuments = await filesCollection.aggregate([
        { $match: matchQuery },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            userId: 1,
            name: 1,
            type: 1,
            isPublic: 1,
            parentId: 1,
          },
        },
      ]).toArray();

      if (fileDocuments.length === 0) return res.status(200).json([]);
      const response = fileDocuments.map((doc) => ({
        id: doc._id,
        userId: doc.userId,
        name: doc.name,
        type: doc.type,
        isPublic: doc.isPublic,
        parentId: doc.parentId,
      }));

      return res.status(200).json(response);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putPublish(req, res) {
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
      const filter = { _id: ObjectId(id), userId: ObjectId(userId) };
      const fileDocument = await filesCollection.findOne(filter);
      if (!fileDocument) return res.status(404).json({ error: 'Not found' });

      const updateDocument = {
        $set: { isPublic: true },
      };
      fileDocument.isPublic = true;

      await filesCollection.updateOne(filter, updateDocument);

      const response = {
        id: fileDocument._id,
        userId: fileDocument.userId,
        name: fileDocument.name,
        type: fileDocument.type,
        isPublic: fileDocument.isPublic,
        parentId: fileDocument.parentId,
      };

      return res.status(200).json(response);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putUnpublish(req, res) {
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
      const filter = { _id: ObjectId(id), userId: ObjectId(userId) };
      const fileDocument = await filesCollection.findOne(filter);
      if (!fileDocument) return res.status(404).json({ error: 'Not found' });

      const updateDocument = {
        $set: { isPublic: false },
      };
      fileDocument.isPublic = false;

      await filesCollection.updateOne(filter, updateDocument);

      const response = {
        id: fileDocument._id,
        userId: fileDocument.userId,
        name: fileDocument.name,
        type: fileDocument.type,
        isPublic: fileDocument.isPublic,
        parentId: fileDocument.parentId,
      };

      return res.status(200).json(response);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = FilesController;
