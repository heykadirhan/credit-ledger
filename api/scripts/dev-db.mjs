// Local MongoDB replica set in memory (transactions need a replica set).
// No MongoDB or Docker install needed. Data is gone when this stops.
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const replSet = await MongoMemoryReplSet.create({
  replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' },
  instanceOpts: [{ port: 27017 }],
});

console.log(`MongoDB replica set ready at ${replSet.getUri()}`);
console.log('Data lives in memory and is wiped when you stop this process.');

const stop = async () => {
  await replSet.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
